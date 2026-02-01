/**
 * Identity management commands
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { generateKeyPair, getFingerprint } from '../lib/crypto';
import { ensureAgentDirs, loadKeys, getAgentPaths, listAgents } from '../lib/config';
import { InitOptions, CommandOptions } from '../types';

/**
 * Initialize a new agent identity
 */
export async function init(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing agent...').start();
  
  try {
    const agentName = options.name.toLowerCase().replace(/\s+/g, '-');
    const paths = await ensureAgentDirs(agentName);
    
    // Check if already initialized
    if (await fs.pathExists(paths.keysFile)) {
      spinner.info('Agent already initialized');
      const existing = await loadKeys(agentName);
      if (existing) {
        console.log(chalk.yellow(`\nExisting agent: ${existing.name}`));
        console.log(chalk.yellow(`Fingerprint: ${existing.fingerprint}`));
        console.log(chalk.gray(`Location: ${paths.agentDir}`));
      }
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
      discoverable: false
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
    
  } catch (err: any) {
    spinner.fail(`Failed to initialize: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Show current agent identity
 */
export async function whoami(options: CommandOptions): Promise<void> {
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
    if (!keys) {
      console.log(chalk.yellow('Could not load agent keys'));
      return;
    }
    
    console.log(chalk.bold('\n🐱 Agent Identity'));
    console.log(`  Name: ${chalk.cyan(keys.name)}`);
    console.log(`  ID: ${keys.agentId}`);
    console.log(`  Fingerprint: ${chalk.cyan(keys.fingerprint)}`);
    console.log(`  Relay: ${keys.relay}`);
    console.log(`  Created: ${keys.created}`);
    console.log(chalk.gray(`\nLocation: ${paths.agentDir}`));
    
    // Show other agents if any
    const allAgents = await listAgents();
    if (allAgents.length > 1) {
      const currentName = agentName || keys.name.toLowerCase().replace(/\s+/g, '-');
      const otherAgents = allAgents.filter(a => a !== currentName);
      if (otherAgents.length > 0) {
        console.log(chalk.gray(`\nOther agents: ${otherAgents.join(', ')}`));
      }
    }
    
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
