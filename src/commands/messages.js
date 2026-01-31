const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const { signMessage, encryptMessage } = require('../lib/crypto');

const { loadKeys, getAgentPaths, loadConfig } = require('../lib/config');
const { DEFAULT_INTENT } = require('./intents');

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

module.exports = { send };
