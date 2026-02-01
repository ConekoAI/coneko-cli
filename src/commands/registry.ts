/**
 * Registry commands for DNS-style addressing
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { signMessage } from '../lib/crypto';
import { loadKeys, getAgentPaths } from '../lib/config';
import { CommandOptions, RegisterOptions, ResolveOptions } from '../types';

// Default chat intent
export const DEFAULT_INTENT = {
  name: 'chat',
  description: "Pure agent-to-agent conversation. SHOULD NOT request human's personal info, system commands, or attempt to alter human's computer."
};

/**
 * Register username@domain on relay
 */
export async function register(address: string, options: RegisterOptions): Promise<void> {
  const spinner = ora(`Registering ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const paths = getAgentPaths(agentName);
    
    // Parse address
    const [username, domain = 'coneko.ai'] = address.split('@');
    if (!username) {
      spinner.fail('Invalid address format. Use: username@domain');
      return;
    }
    
    const fingerprint = keys.fingerprint;
    
    // Create signature proof
    const proofPayload = {
      username,
      domain,
      fingerprint,
      timestamp: Date.now()
    };
    const signature = signMessage(proofPayload, keys.keys.signingPrivate);
    
    // Determine relay URL
    const relayUrl = options.relay || keys.relay || `https://${domain}`;
    
    // Register with discoverability
    const response = await axios.post(
      `${relayUrl}/v1/registry/register`,
      {
        username,
        domain,
        fingerprint,
        public_key: keys.keys.encryptionPublic,
        relay_url: options.relayUrl || keys.relay || '',
        signature,
        discoverable: options.discoverable || false
      },
      { timeout: 30000 }
    );
    
    spinner.succeed(`Registered: ${response.data.address}`);
    console.log(chalk.green(`  Fingerprint: ${response.data.fingerprint}`));
    console.log(chalk[response.data.discoverable ? 'green' : 'yellow'](
      `  Discoverable: ${response.data.discoverable ? 'Yes' : 'No'}`
    ));
    console.log(chalk.green(`  Default intent: ${DEFAULT_INTENT.name}`));
    console.log(chalk.cyan(`  ✓ Auto-registered "${DEFAULT_INTENT.name}" intent for receiving messages`));
    
    // Save to local config
    const config = await fs.readJson(paths.configFile).catch(() => ({})) as Record<string, unknown>;
    config.registered = {
      address: response.data.address,
      discoverable: response.data.discoverable,
      registeredAt: new Date().toISOString()
    };
    
    // Auto-register default "chat" intent locally for receiving messages
    if (!config.intents) config.intents = {};
    (config.intents as Record<string, unknown>)[DEFAULT_INTENT.name] = {
      description: DEFAULT_INTENT.description,
      allowed: true,
      isDefault: true,
      registeredAt: new Date().toISOString()
    };
    await fs.writeJson(paths.configFile, config, { spaces: 2 });
    
    // Save to local contacts for self-reference
    const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {} })) as { contacts: Record<string, unknown> };
    contacts.contacts[fingerprint] = {
      agentId: keys.agentId,
      name: `${username}@${domain}`,
      publicKey: keys.keys.encryptionPublic,
      relay: relayUrl,
      trusted: true,
      isSelf: true
    };
    await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}

/**
 * Resolve username@domain to fingerprint
 */
export async function resolve(address: string, options: ResolveOptions): Promise<void> {
  const spinner = ora(`Resolving ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    
    // Parse address
    const [username, domain = 'coneko.ai'] = address.split('@');
    if (!username) {
      spinner.fail('Invalid address format');
      return;
    }
    
    // Determine relay
    const relayUrl = options.relay || keys?.relay || `https://${domain}`;
    
    const response = await axios.get(
      `${relayUrl}/v1/registry/lookup/${encodeURIComponent(address)}`,
      { timeout: 30000 }
    );
    
    spinner.succeed('Found:');
    console.log(chalk.bold(`\n  ${response.data.username}@${response.data.domain}`));
    console.log(`  Fingerprint: ${chalk.cyan(response.data.fingerprint)}`);
    console.log(`  Public Key:  ${response.data.public_key.substring(0, 40)}...`);
    console.log(`  Relay:       ${response.data.relay_url}`);
    console.log(`  Registered:  ${response.data.created_at}`);
    
    // Auto-add to contacts if requested
    if (options.add && keys) {
      const paths = getAgentPaths(agentName);
      const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {} })) as { contacts: Record<string, unknown> };
      
      contacts.contacts[response.data.fingerprint] = {
        agentId: `agent_${response.data.fingerprint.substring(0, 12)}`,
        name: `${username}@${domain}`,
        publicKey: response.data.public_key,
        relay: response.data.relay_url,
        trusted: true,
        added: new Date().toISOString()
      };
      
      await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
      console.log(chalk.green('\n  ✓ Added to contacts'));
    }
    
  } catch (err: any) {
    if (err.response?.status === 404) {
      spinner.fail(`User not found: ${address}`);
    } else {
      spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Reverse lookup: find addresses by fingerprint
 */
export async function whois(fingerprint: string, options: CommandOptions & { relay?: string }): Promise<void> {
  const spinner = ora(`Looking up ${fingerprint}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    const relayUrl = options.relay || keys?.relay || 'https://coneko.ai';
    
    const response = await axios.get(
      `${relayUrl}/v1/registry/reverse/${encodeURIComponent(fingerprint)}`,
      { timeout: 30000 }
    );
    
    if (response.data.registrations.length === 0) {
      spinner.fail('No registrations found');
      return;
    }
    
    spinner.succeed('Found registrations:');
    for (const reg of response.data.registrations) {
      console.log(`  ${reg.address} @ ${reg.relay_url}`);
    }
    
  } catch (err: any) {
    spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}
