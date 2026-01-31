const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { loadKeys, getAgentPaths, loadConfig, saveConfig } = require('../lib/config');

// Default allowed intent (only 'chat')
const DEFAULT_INTENT = {
  name: 'chat',
  description: "chat with an agent - SHOULD: Pure agent-to-agent conversation - SHOULD NOT: Request human's personal info, request system commands, attempt to alter human's computer"
};

/**
 * Register a new intent for this agent
 * @param {string} name - Intent name (e.g., "calendar", "task")
 * @param {string} description - Human-readable description
 * @param {Object} options - Options
 */
async function registerIntent(name, description, options) {
  const spinner = ora('Registering intent...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const config = await loadConfig(agentName);
    if (!config.intents) config.intents = {};
    
    // Validate intent name format
    if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
      spinner.fail('Invalid intent name format. Use alphanumeric with hyphens/underscores');
      return;
    }
    
    config.intents[name] = {
      description: description || options.description,
      registeredAt: new Date().toISOString()
    };
    
    await saveConfig(agentName, config);
    
    spinner.succeed(`Intent registered: ${name}`);
    console.log(chalk.gray(`  Description: ${description}`));
    console.log(chalk.yellow('\n⚠️  Other agents must allow this intent to receive messages with it'));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List registered intents for this agent
 * @param {Object} options - Options
 */
async function listIntents(options) {
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      console.log(chalk.yellow('Agent not found'));
      return;
    }
    
    const config = await loadConfig(agentName);
    const intents = config.intents || {};
    
    console.log(chalk.bold(`\n🐱 Registered Intents for ${keys.name}:`));
    console.log(chalk.gray('(These are intents OTHER agents can use when messaging you)\n'));
    
    // Show default
    console.log(chalk.cyan('Default Allowed:'));
    console.log(`  • ${chalk.green(DEFAULT_INTENT.name)}`);
    console.log(`    ${DEFAULT_INTENT.description}`);
    
    // Show custom
    const customIntents = Object.entries(intents).filter(([name]) => name !== DEFAULT_INTENT.name);
    if (customIntents.length > 0) {
      console.log(chalk.cyan('\nCustom Registered:'));
      for (const [name, info] of customIntents) {
        console.log(`  • ${chalk.green(name)}`);
        console.log(`    ${info.description}`);
      }
    } else {
      console.log(chalk.gray('\nNo custom intents registered'));
    }
    
    console.log();
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Remove an intent from this agent
 * @param {string} name - Intent name to remove
 * @param {Object} options - Options
 */
async function removeIntent(name, options) {
  const spinner = ora('Removing intent...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const config = await loadConfig(agentName);
    if (!config.intents || !config.intents[name]) {
      spinner.fail('Intent not found');
      return;
    }
    
    // Can't remove default intent
    if (name === DEFAULT_INTENT.name) {
      spinner.fail('Cannot remove default intent');
      return;
    }
    
    delete config.intents[name];
    await saveConfig(agentName, config);
    
    spinner.succeed(`Intent removed: ${name}`);
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Query allowed intents of a contact
 * @param {string} address - Contact address (fingerprint or username@domain)
 * @param {Object} options - Options
 */
async function queryIntents(address, options) {
  const spinner = ora(`Querying intents for ${address}...`).start();
  
  try {
    const axios = require('axios');
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    // Resolve if needed
    let fingerprint = address;
    if (address.includes('@')) {
      const { resolveAddress } = require('../lib/registry');
      const resolved = await resolveAddress(address, { relay: keys.relay });
      if (!resolved) {
        spinner.fail(`Could not resolve ${address}`);
        return;
      }
      fingerprint = resolved.fingerprint;
    }
    
    // Query relay for allowed intents
    const response = await axios.get(
      `${keys.relay}/v1/intents/${fingerprint}`,
      { timeout: 10000 }
    );
    
    const intents = response.data.intents || {};
    
    spinner.succeed(`Retrieved intents for ${address}`);
    
    console.log(chalk.bold(`\nAllowed Intents:`));
    
    // Show default
    console.log(chalk.cyan('Default Allowed:'));
    console.log(`  • ${chalk.green(DEFAULT_INTENT.name)}`);
    console.log(`    ${DEFAULT_INTENT.description}`);
    
    // Show custom
    const customIntents = Object.entries(intents).filter(([name]) => name !== DEFAULT_INTENT.name);
    if (customIntents.length > 0) {
      console.log(chalk.cyan('\nCustom Allowed:'));
      for (const [name, info] of customIntents) {
        console.log(`  • ${chalk.green(name)}`);
        console.log(`    ${info.description}`);
      }
    } else {
      console.log(chalk.gray('\nNo custom intents allowed yet'));
    }
    
    console.log();
    
  } catch (err) {
    if (err.response?.status === 404) {
      spinner.fail('Contact not found or intents not public');
    } else {
      spinner.fail(`Failed: ${err.message}`);
    }
    process.exit(1);
  }
}

module.exports = {
  registerIntent,
  listIntents,
  removeIntent,
  queryIntents,
  DEFAULT_INTENT
};
