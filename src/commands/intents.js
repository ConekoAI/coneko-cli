const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { loadKeys, getAgentPaths, loadConfig, saveConfig } = require('../lib/config');

// Default allowed intent (only 'chat', always open)
const DEFAULT_INTENT = {
  name: 'chat',
  description: "Pure agent-to-agent conversation. SHOULD NOT: Request human's personal info, system commands, or attempt to alter human's computer."
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
    
    // Validate intent name format
    if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
      spinner.fail('Invalid intent name format. Use alphanumeric with hyphens/underscores');
      return;
    }
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    const privileged = options.privileged || false;
    
    // Register with server
    await axios.post(
      `${keys.relay}/v1/intents/register`,
      { name, description, privileged },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    // Also save locally for reference
    const config = await loadConfig(agentName);
    if (!config.intents) config.intents = {};
    
    config.intents[name] = {
      description: description,
      privileged: privileged,
      registeredAt: new Date().toISOString()
    };
    
    await saveConfig(agentName, config);
    
    spinner.succeed(`Intent registered: ${name}`);
    console.log(chalk.gray(`  Description: ${description}`));
    console.log(chalk.gray(`  Access: ${privileged ? 'Privileged (permission required)' : 'Open (anyone can send)'}`));
    
    if (privileged) {
      console.log(chalk.yellow(`\n⚠️  This is a privileged intent.`));
      console.log(chalk.gray(`   Use 'coneko permit <user> --intent ${name}' to grant access`));
    }
    
  } catch (err) {
    if (err.response?.data?.error) {
      spinner.fail(`Failed: ${err.response.data.error}`);
    } else {
      spinner.fail(`Failed: ${err.message}`);
    }
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
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    // Fetch from server
    const response = await axios.get(
      `${keys.relay}/v1/intents/${username}`,
      { timeout: 10000 }
    );
    
    const intents = response.data.intents || {};
    
    console.log(chalk.bold(`\n🐱 Registered Intents for ${keys.name}:`));
    console.log(chalk.gray('(These are intents OTHER agents can use when messaging you)\n'));
    
    // Show all intents
    const entries = Object.entries(intents);
    if (entries.length === 0) {
      console.log(chalk.gray('No intents registered'));
    } else {
      for (const [name, info] of entries) {
        const access = info.privileged 
          ? chalk.yellow('privileged') 
          : chalk.green('open');
        console.log(`  • ${chalk.cyan(name)} [${access}]`);
        console.log(`    ${info.description}`);
      }
    }
    
    console.log();
    console.log(chalk.gray('Legend:'));
    console.log(chalk.gray(`  ${chalk.green('open')} - Anyone can send messages with this intent`));
    console.log(chalk.gray(`  ${chalk.yellow('privileged')} - Only permitted senders can use this intent\n`));
    
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
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    // Can't remove default intent
    if (name === DEFAULT_INTENT.name) {
      spinner.fail('Cannot remove default intent');
      return;
    }
    
    // Remove from server
    await axios.delete(
      `${keys.relay}/v1/intents/${name}`,
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    // Remove from local config
    const config = await loadConfig(agentName);
    if (config.intents) {
      delete config.intents[name];
      await saveConfig(agentName, config);
    }
    
    spinner.succeed(`Intent removed: ${name}`);
    
  } catch (err) {
    if (err.response?.data?.error) {
      spinner.fail(`Failed: ${err.response.data.error}`);
    } else {
      spinner.fail(`Failed: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Query allowed intents of a contact
 * @param {string} address - Contact address (username@domain)
 * @param {Object} options - Options
 */
async function queryIntents(address, options) {
  const spinner = ora(`Querying intents for ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    // Query relay for allowed intents
    const username = address.includes('@') ? address.split('@')[0] : address;
    
    const response = await axios.get(
      `${keys.relay}/v1/intents/${username}`,
      { timeout: 10000 }
    );
    
    const intents = response.data.intents || {};
    
    spinner.succeed(`Retrieved intents for ${address}`);
    
    console.log(chalk.bold(`\nAllowed Intents:`));
    
    const entries = Object.entries(intents);
    if (entries.length === 0) {
      console.log(chalk.gray('No intents found'));
    } else {
      for (const [name, info] of entries) {
        const access = info.privileged 
          ? chalk.yellow('privileged ⚠️') 
          : chalk.green('open');
        console.log(chalk.cyan(`\n  ${name} [${access}]`));
        console.log(`    ${info.description}`);
        if (info.privileged) {
          console.log(chalk.gray(`    You need permission to use this intent`));
        }
      }
    }
    
    console.log();
    
  } catch (err) {
    if (err.response?.status === 404) {
      spinner.fail('User not found');
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
