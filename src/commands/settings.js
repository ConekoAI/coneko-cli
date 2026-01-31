const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { loadKeys, getAgentPaths } = require('../lib/config');

/**
 * Set account discoverability
 * @param {boolean} discoverable - Whether account should be discoverable
 * @param {Object} options - Options
 */
async function setDiscoverable(discoverable, options) {
  const spinner = ora(`Setting discoverability to ${discoverable}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const response = await axios.post(
      `${keys.relay}/v1/registry/discoverable`,
      { discoverable },
      {
        headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Account is now ${discoverable ? 'discoverable' : 'not discoverable'}`);
    
    // Update local config
    const paths = getAgentPaths(agentName);
    const config = await fs.readJson(paths.configFile).catch(() => ({}));
    config.discoverable = discoverable;
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    console.log(chalk.gray(`  Relay: ${keys.relay}`));
    console.log(chalk[discoverable ? 'green' : 'yellow'](
      discoverable 
        ? '  Your account can now be found via search'
        : '  Your account will not appear in search results'
    ));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response?.data?.error) {
      console.error(chalk.red(`  ${err.response.data.error}`));
    }
    process.exit(1);
  }
}

/**
 * Get current discoverability status
 * @param {Object} options - Options
 */
async function getDiscoverable(options) {
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      console.log(chalk.yellow('Agent not found'));
      return;
    }
    
    const paths = getAgentPaths(agentName);
    const config = await fs.readJson(paths.configFile).catch(() => ({}));
    
    console.log(chalk.bold('\n🐱 Account Discoverability'));
    console.log(`  Agent: ${keys.name}`);
    console.log(`  Fingerprint: ${keys.fingerprint}`);
    console.log(`  Discoverable: ${config.discoverable ? chalk.green('Yes') : chalk.yellow('No')}`);
    
    if (config.discoverable) {
      console.log(chalk.green('\n  ✓ Your account can be found via search'));
      console.log(chalk.gray('    Use "coneko search <query>" to test'));
    } else {
      console.log(chalk.yellow('\n  ✗ Your account is hidden from search'));
      console.log(chalk.gray('    Only those who know your address can find you'));
    }
    
    console.log(chalk.cyan('\n  To change:'));
    console.log(chalk.gray(`    coneko discoverable --agent ${keys.name}`));
    console.log(chalk.gray(`    coneko undiscoverable --agent ${keys.name}`));
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Search discoverable accounts
 * @param {string} query - Search query
 * @param {Object} options - Options
 */
async function searchAccounts(query, options) {
  const spinner = ora(`Searching for "${query}"...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const response = await axios.get(
      `${keys.relay}/v1/registry/search`,
      {
        params: { q: query, limit: options.limit || 20 },
        timeout: 10000
      }
    );
    
    const results = response.data.results || [];
    
    if (results.length === 0) {
      spinner.info('No discoverable accounts found');
      console.log(chalk.gray('\n  Try:'));
      console.log(chalk.gray('    - Searching for a different term'));
      console.log(chalk.gray('    - Asking the person for their exact address'));
      return;
    }
    
    spinner.succeed(`Found ${results.length} account(s)`);
    
    console.log(chalk.bold('\n🐱 Discoverable Accounts:\n'));
    
    for (const account of results) {
      console.log(`  ${chalk.cyan(account.address)}`);
      console.log(`    Fingerprint: ${chalk.gray(account.fingerprint)}`);
      console.log(`    Relay: ${chalk.gray(account.relay)}`);
      console.log(`    Member since: ${chalk.gray(new Date(account.createdAt).toLocaleDateString())}`);
      console.log();
    }
    
    console.log(chalk.gray('  To add: coneko friend-request <address>'));
    
  } catch (err) {
    spinner.fail(`Search failed: ${err.message}`);
    if (err.response?.status === 400) {
      console.error(chalk.yellow('  Query must be at least 2 characters'));
    }
    process.exit(1);
  }
}

/**
 * Get service metrics
 * @param {Object} options - Options
 */
async function getMetrics(options) {
  const spinner = ora('Fetching service metrics...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    
    const relay = keys ? keys.relay : (options.relay || 'https://api.coneko.ai');
    
    const response = await axios.get(
      `${relay}/v1/metrics`,
      { timeout: 10000 }
    );
    
    const metrics = response.data;
    
    spinner.succeed('Service Metrics');
    
    console.log(chalk.bold('\n📊 Coneko Relay Statistics\n'));
    console.log(`  Total Accounts: ${chalk.cyan(metrics.accounts.toLocaleString())}`);
    console.log(`  Messages Sent:  ${chalk.cyan(metrics.messagesSent.toLocaleString())}`);
    console.log(`  Contacts Made:  ${chalk.cyan(metrics.contactsConnected.toLocaleString())}`);
    console.log(`  Last Updated:   ${chalk.gray(new Date(metrics.timestamp).toLocaleString())}`);
    console.log();
    console.log(chalk.gray(`  Relay: ${relay}`));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  setDiscoverable,
  getDiscoverable,
  searchAccounts,
  getMetrics
};
