/**
 * Settings and discoverability commands
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { loadKeys, getAgentPaths } from '../lib/config';
import { CommandOptions, SearchOptions } from '../types';

/**
 * Set account discoverability
 */
export async function setDiscoverable(discoverable: boolean, options: CommandOptions): Promise<void> {
  const spinner = ora(`Setting discoverability to ${discoverable}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    await axios.post(
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
    const config = await fs.readJson(paths.configFile).catch(() => ({})) as Record<string, unknown>;
    config.discoverable = discoverable;
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    console.log(chalk.gray(`  Relay: ${keys.relay}`));
    console.log(chalk[discoverable ? 'green' : 'yellow'](
      discoverable 
        ? '  Your account can now be found via search'
        : '  Your account will not appear in search results'
    ));
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response?.data?.error) {
      console.error(chalk.red(`  ${err.response.data.error}`));
    }
    process.exit(1);
  }
}

/**
 * Get current discoverability status
 */
export async function getDiscoverable(options: CommandOptions): Promise<void> {
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      console.log(chalk.yellow('Agent not found'));
      return;
    }
    
    const paths = getAgentPaths(agentName);
    const config = await fs.readJson(paths.configFile).catch(() => ({})) as { discoverable?: boolean };
    
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
    
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Search discoverable accounts
 */
export async function searchAccounts(query: string, options: SearchOptions): Promise<void> {
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
    
  } catch (err: any) {
    spinner.fail(`Search failed: ${err.message}`);
    if (err.response?.status === 400) {
      console.error(chalk.yellow('  Query must be at least 2 characters'));
    }
    process.exit(1);
  }
}

/**
 * Get service metrics
 */
export async function getMetrics(options: CommandOptions & { relay?: string }): Promise<void> {
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
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}
