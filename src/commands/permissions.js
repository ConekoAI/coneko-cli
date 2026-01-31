const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { loadKeys, getAgentPaths, loadConfig } = require('../lib/config');

/**
 * Grant permission to a sender for a privileged intent
 * @param {string} grantee - Username to grant permission to
 * @param {Object} options - Options
 */
async function grantPermission(grantee, options) {
  const spinner = ora(`Granting permission to ${grantee}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const intent = options.intent;
    if (!intent) {
      spinner.fail('--intent is required');
      return;
    }
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    await axios.post(
      `${keys.relay}/v1/permissions/grant`,
      { grantee, intent },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Granted permission: ${grantee} can use '${intent}' intent`);
    
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
 * Revoke permission from a sender
 * @param {string} grantee - Username to revoke permission from
 * @param {Object} options - Options
 */
async function revokePermission(grantee, options) {
  const spinner = ora(`Revoking permission from ${grantee}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const intent = options.intent;
    if (!intent) {
      spinner.fail('--intent is required');
      return;
    }
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    await axios.post(
      `${keys.relay}/v1/permissions/revoke`,
      { grantee, intent },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Revoked permission: ${grantee} can no longer use '${intent}'`);
    
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
 * List permissions I've granted
 * @param {Object} options - Options
 */
async function listGrantedPermissions(options) {
  const spinner = ora('Fetching permissions...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    const response = await axios.get(
      `${keys.relay}/v1/permissions/granted`,
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    const permissions = response.data.permissions || {};
    const entries = Object.entries(permissions);
    
    spinner.stop();
    
    console.log(chalk.bold(`\n🐱 Permissions Granted by ${keys.name}:`));
    
    if (entries.length === 0) {
      console.log(chalk.gray('No permissions granted yet'));
      console.log(chalk.gray('Use: coneko permit <user> --intent <name>\n'));
      return;
    }
    
    for (const [grantee, intents] of entries) {
      console.log(chalk.cyan(`\n${grantee}:`));
      for (const intent of intents) {
        console.log(`  • ${chalk.green(intent)}`);
      }
    }
    console.log();
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List permissions I've received (what I can send)
 * @param {Object} options - Options
 */
async function listReceivedPermissions(options) {
  const spinner = ora('Fetching permissions...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const username = keys.name?.toLowerCase().replace(/\s+/g, '-');
    
    const response = await axios.get(
      `${keys.relay}/v1/permissions/received`,
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    const permissions = response.data.permissions || {};
    const entries = Object.entries(permissions);
    
    spinner.stop();
    
    console.log(chalk.bold(`\n🐱 Permissions Received by ${keys.name}:`));
    console.log(chalk.gray('(Privileged intents you can use when messaging others)\n'));
    
    if (entries.length === 0) {
      console.log(chalk.gray('No permissions received yet'));
      console.log(chalk.gray('Ask others to grant you permission for their privileged intents\n'));
      return;
    }
    
    for (const [owner, intents] of entries) {
      console.log(chalk.cyan(`${owner}:`));
      for (const intent of intents) {
        console.log(`  • ${chalk.green(intent)}`);
      }
    }
    console.log();
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  grantPermission,
  revokePermission,
  listGrantedPermissions,
  listReceivedPermissions
};
