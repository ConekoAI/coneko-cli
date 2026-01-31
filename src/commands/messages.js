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

const CONeko_DIR = path.join(require('os').homedir(), '.coneko');
const KEYS_FILE = path.join(CONeko_DIR, 'keys.json');
const CONTACTS_FILE = path.join(CONeko_DIR, 'contacts.json');
const INBOX_FILE = path.join(CONeko_DIR, 'inbox.json');

async function send(options) {
  const spinner = ora('Sending message...').start();
  
  try {
    const keys = await fs.readJson(KEYS_FILE);
    const contacts = await fs.readJson(CONTACTS_FILE);
    const contact = contacts.contacts[options.to];
    
    if (!contact) {
      spinner.fail(`Contact not found: ${options.to}`);
      return;
    }
    
    // Build message
    const message = {
      version: '1.0',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      intent: options.intent,
      sender: {
        agentId: keys.agentId,
        fingerprint: keys.fingerprint
      },
      content: {
        format: 'json',
        data: JSON.parse(options.content),
        humanMessage: options.message
      }
    };
    
    // Sign
    message.signature = signMessage(message, keys.keys.signingPrivate);
    
    // Encrypt
    const encrypted = encryptMessage(
      JSON.stringify(message), 
      contact.publicKey
    );
    
    // Send to relay
    const envelope = {
      to: options.to,
      payload: encrypted
    };
    
    const response = await axios.post(
      `${keys.relay}/v1/messages`,
      envelope,
      { timeout: 30000 }
    );
    
    spinner.succeed(`Message sent: ${response.data.messageId}`);
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function poll(options) {
  const spinner = ora('Polling for messages...').start();
  
  try {
    const keys = await fs.readJson(KEYS_FILE);
    
    // Build auth header (simplified - just fingerprint for now)
    const authHeader = `Bearer ${keys.fingerprint}`;
    
    const response = await axios.get(
      `${keys.relay}/v1/messages`,
      {
        headers: { Authorization: authHeader },
        timeout: 30000
      }
    );
    
    const messages = response.data.messages || [];
    spinner.succeed(`Received ${messages.length} message(s)`);
    
    if (messages.length === 0) return;
    
    // Save to inbox
    const inbox = await fs.pathExists(INBOX_FILE) 
      ? await fs.readJson(INBOX_FILE) 
      : { messages: [] };
    
    for (const msg of messages) {
      inbox.messages.push({
        received: new Date().toISOString(),
        relayId: msg.id,
        payload: msg.payload
      });
      
      // Acknowledge if requested
      if (options.ack !== false) {
        try {
          await axios.delete(
            `${keys.relay}/v1/messages/${msg.id}`,
            { headers: { Authorization: authHeader } }
          );
        } catch (ackErr) {
          console.log(chalk.yellow(`  ⚠ Failed to ack: ${msg.id}`));
        }
      }
    }
    
    await fs.writeJson(INBOX_FILE, inbox, { spaces: 2 });
    console.log(chalk.green(`  Saved to inbox: ${INBOX_FILE}`));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function decrypt(filePath) {
  try {
    const keys = await fs.readJson(KEYS_FILE);
    const contacts = await fs.readJson(CONTACTS_FILE);
    const envelope = await fs.readJson(filePath);
    
    // Decrypt
    const decrypted = decryptMessage(
      envelope.payload,
      keys.keys.encryptionPrivate
    );
    const message = JSON.parse(decrypted);
    
    // Verify sender
    const sender = contacts.contacts[message.sender.fingerprint];
    if (!sender) {
      console.log(chalk.red('Unknown sender'));
      return;
    }
    
    if (!verifySignature(message, message.signature, sender.publicKey)) {
      console.log(chalk.red('Invalid signature'));
      return;
    }
    
    console.log(chalk.green('✓ Verified message:'));
    console.log(JSON.stringify(message, null, 2));
    
  } catch (err) {
    console.error(chalk.red(`Failed: ${err.message}`));
    process.exit(1);
  }
}

module.exports = { send, poll, decrypt };
