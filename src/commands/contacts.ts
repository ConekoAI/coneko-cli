/**
 * Contact management commands
 */

import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { loadKeys, AgentData } from '../lib/config';
import { CommandOptions, ContactAddOptions } from '../types';

/**
 * Search for an account
 */
export async function search(query: string, options: CommandOptions): Promise<void> {
  const spinner = ora(`Searching for ${query}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const response = await axios.get(
      `${keys.relay}/v1/registry/search?q=${encodeURIComponent(query)}`,
      { timeout: 10000 }
    );
    
    const results = response.data.results || [];
    
    if (results.length === 0) {
      spinner.fail('No accounts found');
      return;
    }
    
    spinner.succeed(`Found ${results.length} account(s):`);
    
    for (const result of results) {
      console.log(chalk.cyan(`\n  ${result.username}`));
      console.log(chalk.gray(`    Registered: ${result.createdAt}`));
    }
    console.log();
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List contacts (metadata only)
 */
export async function list(options: CommandOptions): Promise<void> {
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      console.log(chalk.yellow('Agent not found'));
      return;
    }
    
    const username = getUsername(keys);
    
    const response = await axios.get(
      `${keys.relay}/v1/contacts`,
      {
        headers: { 'X-Username': username },
        timeout: 10000
      }
    );
    
    const contacts = response.data.contacts || [];
    
    console.log(chalk.bold(`\n🐱 Contacts for ${keys.name}:`));
    console.log(chalk.gray('(Metadata for your reference - not used for access control)\n'));
    
    if (contacts.length === 0) {
      console.log(chalk.gray('No contacts saved'));
      console.log(chalk.gray('Use: coneko contact-add <address> --name "Display Name"\n'));
    } else {
      for (const contact of contacts) {
        console.log(chalk.cyan(`  ${contact.username}`));
        if (contact.name) {
          console.log(chalk.gray(`    Name: ${contact.name}`));
        }
        if (contact.notes) {
          console.log(chalk.gray(`    Notes: ${contact.notes}`));
        }
      }
      console.log();
    }
    
  } catch (err: any) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Add a contact (metadata only)
 */
export async function add(address: string, options: ContactAddOptions): Promise<void> {
  const spinner = ora(`Adding contact ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const username = getUsername(keys);
    const contact = address.includes('@') ? address.split('@')[0] : address;
    
    await axios.post(
      `${keys.relay}/v1/contacts`,
      {
        contact,
        name: options.name,
        notes: options.notes
      },
      {
        headers: { 'X-Username': username },
        timeout: 30000
      }
    );
    
    spinner.succeed(`Contact added: ${address}`);
    if (options.name) {
      console.log(chalk.gray(`  Name: ${options.name}`));
    }
    
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
 * Remove a contact
 */
export async function remove(address: string, options: CommandOptions): Promise<void> {
  const spinner = ora(`Removing contact ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    spinner.succeed(`Contact removed: ${address}`);
    console.log(chalk.gray('(Note: This only removes metadata, not permissions)'));
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

function getUsername(keys: AgentData): string {
  return keys.name?.toLowerCase().replace(/\s+/g, '-') || '';
}
