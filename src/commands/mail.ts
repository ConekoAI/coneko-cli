/**
 * Mail polling commands
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { ensureAgentDirs, loadKeys, getAgentPaths, loadConfig, AgentConfig } from '../lib/config';
import { decryptMessage } from '../lib/crypto';
import { PollOptions, PolledMessage } from '../types';

/**
 * Poll for messages from relay and save to agent's polled folder
 */
export async function check(options: PollOptions): Promise<{ count: number; agentName?: string; agentDir?: string }> {
  const spinner = ora('Checking for messages...').start();
  
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    
    // Load identity
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail(agentName ? `Agent "${agentName}" not found` : 'No agent initialized');
      console.log(chalk.yellow('Run: coneko init -n <name>'));
      return { count: 0 };
    }
    
    // Ensure directories exist
    await ensureAgentDirs(agentName || keys.name);
    
    spinner.text = `Fetching messages for ${keys.name}...`;
    
    // Fetch from relay
    const config: AgentConfig & { registered?: { address: string } } = await loadConfig(agentName);
    let username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    if (config.registered?.address) {
      username = config.registered.address.split('@')[0];
    }
    
    const response = await axios.get(
      `${keys.relay}/v1/messages`,
      {
        headers: { 'X-Username': username },
        params: { limit: options.limit || 10 },
        timeout: 30000
      }
    );
    
    const messages: PolledMessage[] = response.data.messages || [];
    
    if (messages.length === 0) {
      spinner.succeed('No new messages');
      config.lastPoll = new Date().toISOString();
      await fs.writeJson(paths.configFile, config, { spaces: 2 });
      return { count: 0, agentName: keys.name, agentDir: paths.agentDir };
    }
    
    spinner.text = `Received ${messages.length} message(s), saving to polled folder...`;
    
    // Save to polled folder (raw, unaudited)
    interface SavedFile { id: string; path: string; decrypted: boolean }
    const savedFiles: SavedFile[] = [];
    
    for (const msg of messages) {
      const fileName = `msg-${msg.id}.json`;
      const filePath = path.join(paths.polledDir, fileName);
      
      const messageData: Record<string, unknown> = {
        ...msg,
        _receivedAt: new Date().toISOString(),
        _agentName: keys.name,
        _agentFingerprint: keys.fingerprint
      };
      
      // Optionally decrypt for easier human audit
      if (options.decrypt && msg.content) {
        try {
          const payload = typeof msg.content === 'string' 
            ? JSON.parse(msg.content) 
            : msg.content;
          
          const decrypted = decryptMessage(payload, keys.keys.encryptionPrivate);
          const decryptedMessage = JSON.parse(decrypted);
          
          messageData._decrypted = {
            from: decryptedMessage.sender?.name || decryptedMessage.sender?.fingerprint || 'unknown',
            fingerprint: decryptedMessage.sender?.fingerprint,
            intents: decryptedMessage.intents,
            content: decryptedMessage.content,
            humanMessage: decryptedMessage.content?.humanMessage,
            decryptedAt: new Date().toISOString()
          };
          
          messageData._encryptedPayload = msg.content;
          delete messageData.content;
          
        } catch (decryptErr: any) {
          messageData._decryptError = decryptErr.message;
        }
      }
      
      await fs.writeJson(filePath, messageData, { spaces: 2 });
      savedFiles.push({ id: msg.id, path: filePath, decrypted: !!messageData._decrypted });
      
      // Acknowledge (delete from relay)
      if (options.ack !== false) {
        try {
          await axios.delete(
            `${keys.relay}/v1/messages/${msg.id}`,
            { headers: { 'X-Username': username } }
          );
        } catch {
          spinner.warn(`Failed to ack message ${msg.id}`);
        }
      }
    }
    
    // Update lastPoll timestamp
    config.lastPoll = new Date().toISOString();
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    const decryptedCount = savedFiles.filter(f => f.decrypted).length;
    spinner.succeed(`Saved ${savedFiles.length} message(s) to ${paths.polledDir}`);
    
    if (decryptedCount > 0) {
      console.log(chalk.green(`   ✓ ${decryptedCount} message(s) decrypted for easy reading`));
    }
    
    console.log(chalk.cyan('\n📬 New messages received'));
    console.log(chalk.gray(`   Agent: ${keys.name}`));
    console.log(chalk.gray(`   Location: ${paths.polledDir}`));
    
    if (!options.decrypt) {
      console.log(chalk.gray(`   Format: Encrypted (use --decrypt for plaintext)`));
    } else {
      console.log(chalk.gray(`   Format: Decrypted (human-readable)`));
    }
    
    console.log(chalk.yellow('\nNext steps:'));
    console.log(chalk.gray('   1. Read messages directly from the polled folder'));
    console.log(chalk.gray('   2. Process as needed, then archive to read/ folder\n'));
    
    return { 
      count: savedFiles.length, 
      agentName: keys.name,
      agentDir: paths.agentDir
    };
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response) {
      console.error(chalk.red(`   Server error: ${err.response.status} ${err.response.statusText}`));
    }
    throw err;
  }
}
