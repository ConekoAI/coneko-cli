const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const { 
  signMessage, 
  encryptMessage, 
  decryptMessage, 
  verifySignature 
} = require('../lib/crypto');

const { loadKeys, getAgentPaths, loadConfig } = require('../lib/config');

// Default chat intent - simple name + description format (not URI)
const DEFAULT_INTENT = {
  name: 'chat',
  description: "Pure agent-to-agent conversation. SHOULD NOT request human's personal info, system commands, or attempt to alter human's computer."
};

/**
 * Send a message with one or more intents
 * @param {Object} options - Send options
 */
async function send(options) {
  const spinner = ora('Sending message...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const paths = getAgentPaths(agentName);
    const contacts = await fs.readJson(paths.contactsFile);
    const contact = contacts.contacts[options.to];
    
    if (!contact) {
      spinner.fail(`Contact not found: ${options.to}`);
      console.log(chalk.yellow('Run: coneko resolve <address> --add'));
      return;
    }
    
    // Parse intents (can be single or multiple, comma-separated names)
    const intentNames = options.intent.split(',').map(i => i.trim());
    
    // Build intents with descriptions
    const intents = intentNames.map(name => {
      if (name === DEFAULT_INTENT.name) {
        return { ...DEFAULT_INTENT };
      }
      // For custom intents, fetch description from config or use generic
      return {
        name,
        description: 'Custom intent'
      };
    });
    
    // Query recipient's allowed intents first
    spinner.text = 'Checking recipient intent permissions...';
    try {
      const intentCheck = await axios.post(
        `${keys.relay}/v1/intents/check`,
        {
          recipient: options.to,
          intents: intentNames
        },
        { timeout: 10000 }
      );
      
      if (!intentCheck.data.allowed) {
        const blocked = intentCheck.data.blocked_intents || [];
        spinner.fail(`Intent not allowed by recipient: ${blocked.join(', ')}`);
        console.log(chalk.yellow('\nThis message was NOT delivered.'));
        console.log(chalk.yellow('The recipient must register these intents:'));
        for (const intent of blocked) {
          console.log(chalk.gray(`  - ${intent}`));
        }
        console.log(chalk.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
        return { bounced: true, blockedIntents: blocked };
      }
    } catch (checkErr) {
      // If check fails, continue anyway - relay will enforce
      spinner.warn('Could not verify intents, relay will enforce');
    }
    
    // Build message with intents (name + description format for audit)
    const message = {
      version: '1.2',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      intents: intents,  // Array of {name, description} objects for audit review
      sender: {
        agentId: keys.agentId,
        fingerprint: keys.fingerprint,
        name: keys.name
      },
      content: {
        format: 'json',
        data: JSON.parse(options.content),
        humanMessage: options.message
      }
    };
    
    spinner.text = 'Encrypting and signing...';
    
    // Sign
    message.signature = signMessage(message, keys.keys.signingPrivate);
    
    // Encrypt
    const encrypted = encryptMessage(
      JSON.stringify(message), 
      contact.publicKey
    );
    
    // Send to relay
    spinner.text = 'Sending to relay...';
    const envelope = {
      to: options.to,
      intents: intents,  // Send full intent objects with descriptions
      payload: encrypted
    };
    
    const response = await axios.post(
      `${keys.relay}/v1/messages`,
      envelope,
      { timeout: 30000 }
    );
    
    spinner.succeed(`Message sent: ${response.data.messageId}`);
    console.log(chalk.gray(`  Intents: ${intentNames.join(', ')}`));
    
    return { sent: true, messageId: response.data.messageId };
    
  } catch (err) {
    if (err.response?.status === 403) {
      // Intent not allowed - bounced by relay
      const blocked = err.response.data.blocked_intents || [];
      spinner.fail('Message bounced: intent not allowed');
      console.log(chalk.yellow('\n⚠️  The recipient does not allow these intents:'));
      for (const intent of blocked) {
        console.log(chalk.gray(`  - ${intent}`));
      }
      console.log(chalk.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
      return { bounced: true, blockedIntents: blocked };
    }
    
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Poll for messages
 * @param {Object} options - Poll options
 */
async function poll(options) {
  const spinner = ora('Polling messages...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const paths = getAgentPaths(agentName);
    
    // Ensure polled directory exists
    const polledDir = path.join(paths.baseDir, 'polled');
    await fs.ensureDir(polledDir);
    
    // Poll from relay
    const response = await axios.get(
      `${keys.relay}/v1/messages`,
      {
        headers: { 'X-Fingerprint': keys.fingerprint },
        timeout: 30000
      }
    );
    
    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      spinner.succeed('No new messages');
      return { messages: [] };
    }
    
    // Process and save each message
    const processedMessages = [];
    for (const msg of messages) {
      try {
        // Decrypt payload
        const decrypted = decryptMessage(msg.payload, keys.keys.encryptionPrivate);
        const messageData = JSON.parse(decrypted);
        
        // Save to polled directory
        const messageFile = path.join(polledDir, `${msg.id}.json`);
        const messageRecord = {
          id: msg.id,
          senderFp: msg.senderFp,
          intents: msg.intents,  // Includes name and description for audit
          content: messageData.content,
          sender: messageData.sender,
          signature: messageData.signature,
          createdAt: msg.createdAt,
          expiresAt: msg.expiresAt
        };
        
        await fs.writeJson(messageFile, messageRecord, { spaces: 2 });
        processedMessages.push(messageRecord);
        
        // Acknowledge (delete) from server
        await axios.delete(
          `${keys.relay}/v1/messages/${msg.id}`,
          {
            headers: { 'X-Fingerprint': keys.fingerprint },
            timeout: 10000
          }
        );
      } catch (decryptErr) {
        console.warn(chalk.yellow(`\nWarning: Could not decrypt message ${msg.id}`));
      }
    }
    
    spinner.succeed(`Received ${processedMessages.length} message(s)`);
    
    // Update lastPoll timestamp
    const config = await loadConfig(agentName);
    config.lastPoll = new Date().toISOString();
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    return { messages: processedMessages };
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { send, poll, DEFAULT_INTENT };
