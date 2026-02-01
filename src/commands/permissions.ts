/**
 * Permission management commands
 */

import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { loadKeys } from '../lib/config';
import { CommandOptions, PermissionOptions, AgentData } from '../types';

/**
 * Grant permission to a sender for a privileged intent
 */
export async function grantPermission(grantee: string, options: PermissionOptions): Promise<void> {
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
    
    const username = getUsername(keys);
    
    await axios.post(
      `${keys.relay}/v1/permissions/grant`,
      { grantee, intent },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Granted permission: ${grantee} can use '${intent}' intent`);
    
  } catch (err: any) {
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
 */
export async function revokePermission(grantee: string, options: PermissionOptions): Promise<void> {
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
    
    const username = getUsername(keys);
    
    await axios.post(
      `${keys.relay}/v1/permissions/revoke`,
      { grantee, intent },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Revoked permission: ${grantee} can no longer use '${intent}'`);
    
  } catch (err: any) {
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
 */
export async function listGrantedPermissions(options: CommandOptions): Promise<void> {
  const spinner = ora('Fetching permissions...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const username = getUsername(keys);
    
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
      for (const intent of intents as string[]) {
        console.log(`  • ${chalk.green(intent)}`);
      }
    }
    console.log();
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List permissions I've received (what I can send)
 */
export async function listReceivedPermissions(options: CommandOptions): Promise<void> {
  const spinner = ora('Fetching permissions...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const username = getUsername(keys);
    
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
      for (const intent of intents as string[]) {
        console.log(`  • ${chalk.green(intent)}`);
      }
    }
    console.log();
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

function getUsername(keys: AgentData): string {
  return keys.name?.toLowerCase().replace(/\s+/g, '-') || '';
}
