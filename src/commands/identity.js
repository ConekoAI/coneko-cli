const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { generateKeyPair, getFingerprint } = require('../lib/crypto');

const CONeko_DIR = path.join(require('os').homedir(), '.coneko');
const KEYS_FILE = path.join(CONeko_DIR, 'keys.json');
const CONTACTS_FILE = path.join(CONeko_DIR, 'contacts.json');
const PERMISSIONS_FILE = path.join(CONeko_DIR, 'permissions.json');

async function init(options) {
  const spinner = ora('Initializing agent...').start();
  
  try {
    await fs.ensureDir(CONeko_DIR);
    
    if (await fs.pathExists(KEYS_FILE)) {
      spinner.fail('Agent already initialized');
      console.log(chalk.yellow('Run "coneko whoami" to see current identity'));
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
    
    await fs.writeJson(KEYS_FILE, keyData, { spaces: 2 });
    await fs.writeJson(CONTACTS_FILE, { contacts: {} }, { spaces: 2 });
    await fs.writeJson(PERMISSIONS_FILE, { contacts: {} }, { spaces: 2 });
    
    spinner.succeed('Agent initialized');
    console.log(chalk.green(`\nAgent ID: ${agentId}`));
    console.log(chalk.green(`Fingerprint: ${fingerprint}`));
    console.log(chalk.green(`Relay: ${options.relay}`));
    console.log(chalk.yellow(`\nKeys stored in: ${KEYS_FILE}`));
    console.log(chalk.red('Keep this file secure — it contains your private keys!'));
    
  } catch (err) {
    spinner.fail(`Failed to initialize: ${err.message}`);
    process.exit(1);
  }
}

async function whoami() {
  try {
    if (!await fs.pathExists(KEYS_FILE)) {
      console.log(chalk.yellow('No agent initialized. Run: coneko init -n <name>'));
      return;
    }
    
    const keys = await fs.readJson(KEYS_FILE);
    console.log(chalk.bold('\nAgent Identity:'));
    console.log(`  Name: ${keys.name}`);
    console.log(`  ID: ${keys.agentId}`);
    console.log(`  Fingerprint: ${chalk.cyan(keys.fingerprint)}`);
    console.log(`  Relay: ${keys.relay}`);
    console.log(`  Created: ${keys.created}`);
    
    // Show workspace hint
    const workspace = path.join(CONeko_DIR, keys.name.toLowerCase().replace(/\s+/g, '-'));
    console.log(chalk.gray(`\nWorkspace: ${workspace}`));
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

module.exports = { init, whoami };
