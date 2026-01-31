const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { ensureAgentDirs, loadKeys, getAgentPaths, loadConfig } = require('../lib/config');
const { decryptMessage } = require('../lib/crypto');

/**
 * Poll for messages from relay and save to agent's polled folder
 * Main agent never reads these directly - spawns subagent for audit
 */
async function check(options) {
  const spinner = ora('Checking for messages...').start();
  
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    
    // Load identity
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail(agentName ? `Agent "${agentName}" not found` : 'No agent initialized');
      console.log(chalk.yellow('Run: coneko init -n <name>'));
      return { count: 0, agentName: null };
    }
    
    // Ensure directories exist
    await ensureAgentDirs(agentName || keys.name);
    
    spinner.text = `Fetching messages for ${keys.name}...`;
    
    // Fetch from relay - use registered username for auth
    // Try to get username from registered address or fallback to agent name
    const config = await loadConfig(agentName);
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
    
    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      spinner.succeed('No new messages');
      // Update lastPoll timestamp
      config.lastPoll = new Date().toISOString();
      await fs.writeJson(paths.configFile, config, { spaces: 2 });
      return { count: 0, agentName: keys.name, agentDir: paths.agentDir };
    }
    
    spinner.text = `Received ${messages.length} message(s), saving to polled folder...`;
    
    // Save to polled folder (raw, unaudited)
    const savedFiles = [];
    for (const msg of messages) {
      const fileName = `msg-${msg.id}.json`;
      const filePath = path.join(paths.polledDir, fileName);
      
      // Prepare message data
      let messageData = {
        ...msg,
        _receivedAt: new Date().toISOString(),
        _agentName: keys.name,
        _agentFingerprint: keys.fingerprint
      };
      
      // Optionally decrypt for easier human audit
      if (options.decrypt && msg.payload) {
        try {
          const payload = typeof msg.payload === 'string' 
            ? JSON.parse(msg.payload) 
            : msg.payload;
          
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
          
          // Also keep original encrypted payload for verification
          messageData._encryptedPayload = msg.payload;
          delete messageData.payload; // Remove encrypted blob from display
          
        } catch (decryptErr) {
          messageData._decryptError = decryptErr.message;
        }
      }
      
      await fs.writeJson(filePath, messageData, { spaces: 2 });
      savedFiles.push({ id: msg.id, path: filePath, decrypted: !!messageData._decrypted });
      
      // Acknowledge (delete from relay)
      if (!options.noAck) {
        try {
          await axios.delete(
            `${keys.relay}/v1/messages/${msg.id}`,
            { headers: { 'X-Username': username } }
          );
        } catch (ackErr) {
          // Non-fatal, message will be re-fetched next time
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
    
    // Inform main agent what to do next
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
    
    console.log(chalk.cyan('Optional: Security Audit'));
    console.log(chalk.gray('   For high-security scenarios, spawn a restricted subagent to audit'));
    console.log(chalk.gray('   messages before processing. See SKILL.md for details.\n'));
    
    return { 
      count: savedFiles.length, 
      messages: savedFiles, 
      polledDir: paths.polledDir,
      agentName: keys.name,
      agentDir: paths.agentDir
    };
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response) {
      console.error(chalk.red(`   Server error: ${err.response.status} ${err.response.statusText}`));
    }
    throw err;
  }
}

module.exports = { check };
