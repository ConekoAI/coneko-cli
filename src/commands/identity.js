const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { generateKeyPair, getFingerprint } = require('../lib/crypto');
const { ensureAgentDirs, loadKeys, getAgentPaths } = require('../lib/config');

async function init(options) {
  const spinner = ora('Initializing agent...').start();
  
  try {
    const agentName = options.name.toLowerCase().replace(/\s+/g, '-');
    const paths = await ensureAgentDirs(agentName);
    
    // Check if already initialized
    if (await fs.pathExists(paths.keysFile)) {
      spinner.info('Agent already initialized');
      const existing = await loadKeys(agentName);
      console.log(chalk.yellow(`\nExisting agent: ${existing.name}`));
      console.log(chalk.yellow(`Fingerprint: ${existing.fingerprint}`));
      console.log(chalk.gray(`Location: ${paths.agentDir}`));
      return;
    }
    
    const keyPair = generateKeyPair();
    const fingerprint = getFingerprint(keyPair.encryptionPublic);
    const agentId = `agent_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    
    const keyData = {
      agentId,
      name: options.name,
      relay: options.relay,
      keys: keyPair,
      fingerprint,
      created: new Date().toISOString()
    };
    
    await fs.writeJson(paths.keysFile, keyData, { spaces: 2 });
    await fs.writeJson(paths.contactsFile, { contacts: {} }, { spaces: 2 });
    await fs.writeJson(paths.permissionsFile, { contacts: {} }, { spaces: 2 });
    await fs.writeJson(paths.configFile, { 
      relay: options.relay,
      lastPoll: null,
      discoverable: false  // Default: not discoverable
    }, { spaces: 2 });
    
    spinner.succeed(`Agent "${options.name}" initialized`);
    console.log(chalk.green(`
Agent ID: ${agentId}`));
    console.log(chalk.green(`Fingerprint: ${fingerprint}`));
    console.log(chalk.green(`Relay: ${options.relay}`));
    console.log(chalk.cyan(`\nWorkspace: ${paths.agentDir}`));
    console.log(chalk.gray(`  keys.json       - Identity (keep secure!)`));
    console.log(chalk.gray(`  config.json     - Settings`));
    console.log(chalk.gray(`  polled/         - Incoming messages`));
    console.log(chalk.gray(`  read/           - Processed archive`));
    console.log(chalk.red(`\n⚠️  Keep keys.json secure — it contains your private keys!`));
    
  } catch (err) {
    spinner.fail(`Failed to initialize: ${err.message}`);
    process.exit(1);
  }
}

async function whoami(options) {
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    
    if (!await fs.pathExists(paths.keysFile)) {
      if (agentName) {
        console.log(chalk.yellow(`No agent "${agentName}" found.`));
      } else {
        console.log(chalk.yellow('No default agent initialized.'));
      }
      console.log(chalk.yellow('Run: coneko init -n <name>'));
      return;
    }
    
    const keys = await loadKeys(agentName);
    console.log(chalk.bold('\n🐱 Agent Identity'));
    console.log(`  Name: ${chalk.cyan(keys.name)}`);
    console.log(`  ID: ${keys.agentId}`);
    console.log(`  Fingerprint: ${chalk.cyan(keys.fingerprint)}`);
    console.log(`  Relay: ${keys.relay}`);
    console.log(`  Created: ${keys.created}`);
    console.log(chalk.gray(`\nLocation: ${paths.agentDir}`));
    
    // Show other agents if any
    const { listAgents } = require('../lib/config');
    const allAgents = await listAgents();
    if (allAgents.length > 1) {
      console.log(chalk.gray(`\nOther agents: ${allAgents.filter(a => a !== (agentName || keys.name.toLowerCase().replace(/\s+/g, '-'))).join(', ')}`));
    }
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

module.exports = { init, whoami };
