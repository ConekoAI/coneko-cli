/**
 * Message sending commands
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { signMessage, encryptMessage } from '../lib/crypto';
import { loadKeys, getAgentPaths } from '../lib/config';
import { SendOptions, SendResult } from '../types';

// Default allowed intent
const DEFAULT_INTENT = {
  name: 'chat',
  description: "Pure agent-to-agent conversation. SHOULD NOT: Request human's personal info, system commands, or attempt to alter human's computer."
};

/**
 * Send a message with one or more intents
 */
export async function send(options: SendOptions): Promise<SendResult> {
  const spinner = ora('Sending message...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return {};
    }
    
    const paths = getAgentPaths(agentName);
    const contacts = await fs.readJson(paths.contactsFile) as { contacts: Record<string, { publicKey: string }> };
    const contact = contacts.contacts[options.to];
    
    if (!contact) {
      spinner.fail(`Contact not found: ${options.to}`);
      console.log(chalk.yellow('Run: coneko resolve <address> --add'));
      return {};
    }
    
    // Parse intents (can be single or multiple, comma-separated names)
    const intentNames = options.intent.split(',').map(i => i.trim());
    
    // Build intents with descriptions
    const intents = intentNames.map(name => {
      if (name === DEFAULT_INTENT.name) {
        return { ...DEFAULT_INTENT };
      }
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
        const blocked: string[] = intentCheck.data.blocked_intents || [];
        spinner.fail(`Intent not allowed by recipient: ${blocked.join(', ')}`);
        console.log(chalk.yellow('\nThis message was NOT delivered.'));
        console.log(chalk.yellow('The recipient must register these intents:'));
        for (const intent of blocked) {
          console.log(chalk.gray(`  - ${intent}`));
        }
        console.log(chalk.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
        return { bounced: true };
      }
    } catch {
      spinner.warn('Could not verify intents, relay will enforce');
    }
    
    // Build message with intents
    const message: Record<string, unknown> = {
      version: '1.2',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      intents: intents,
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
    
    // Sign and add signature to message
    message.signature = signMessage(message as any, keys.keys.signingPrivate);
    
    // Encrypt
    const encrypted = encryptMessage(
      JSON.stringify(message), 
      contact.publicKey
    );
    
    // Send to relay
    spinner.text = 'Sending to relay...';
    const envelope = {
      to: options.to,
      intents: intents,
      payload: encrypted
    };
    
    const response = await axios.post(
      `${keys.relay}/v1/messages`,
      envelope,
      { timeout: 30000 }
    );
    
    spinner.succeed(`Message sent: ${response.data.messageId}`);
    console.log(chalk.gray(`  Intents: ${intentNames.join(', ')}`));
    
    return { success: true, messageId: response.data.messageId };
    
  } catch (err: any) {
    if (err.response?.status === 403) {
      const blocked: string[] = err.response.data.blocked_intents || [];
      spinner.fail('Message bounced: intent not allowed');
      console.log(chalk.yellow('\n⚠️  The recipient does not allow these intents:'));
      for (const intent of blocked) {
        console.log(chalk.gray(`  - ${intent}`));
      }
      console.log(chalk.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
      return { bounced: true };
    }
    
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export { DEFAULT_INTENT };
