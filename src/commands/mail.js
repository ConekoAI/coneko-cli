const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { ensureAgentDirs, loadKeys, getAgentPaths, loadConfig } = require('../lib/config');

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
    
    // Fetch from relay
    const authHeader = `Bearer ${keys.fingerprint}`;
    const response = await axios.get(
      `${keys.relay}/v1/messages`,
      {
        headers: { Authorization: authHeader },
        params: { limit: options.limit || 10 },
        timeout: 30000
      }
    );
    
    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      spinner.succeed('No new messages');
      // Update lastPoll timestamp
      const config = await loadConfig(agentName);
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
      
      // Save with metadata for audit
      const messageData = {
        ...msg,
        _receivedAt: new Date().toISOString(),
        _agentName: keys.name,
        _agentFingerprint: keys.fingerprint
      };
      
      await fs.writeJson(filePath, messageData, { spaces: 2 });
      savedFiles.push({ id: msg.id, path: filePath });
      
      // Acknowledge (delete from relay)
      if (!options.noAck) {
        try {
          await axios.delete(
            `${keys.relay}/v1/messages/${msg.id}`,
            { headers: { Authorization: authHeader } }
          );
        } catch (ackErr) {
          // Non-fatal, message will be re-fetched next time
          spinner.warn(`Failed to ack message ${msg.id}`);
        }
      }
    }
    
    // Update lastPoll timestamp
    const config = await loadConfig(agentName);
    config.lastPoll = new Date().toISOString();
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    spinner.succeed(`Saved ${savedFiles.length} message(s) to ${paths.polledDir}`);
    
    // Inform main agent what to do next
    console.log(chalk.cyan('\n📬 Messages ready for audit'));
    console.log(chalk.gray(`   Agent: ${keys.name}`));
    console.log(chalk.gray(`   Location: ${paths.polledDir}`));
    console.log(chalk.yellow('\nNext steps for main agent:'));
    console.log(chalk.gray('   1. Check if coneko-gateway agent exists: agents_list'));
    console.log(chalk.gray('   2. If missing: coneko setup-gateway'));
    console.log(chalk.gray('   3. Spawn audit subagent with inbox path'));
    console.log(chalk.gray('   4. Process audited results\n'));
    
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
