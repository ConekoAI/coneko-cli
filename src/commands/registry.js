const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');

const { signMessage, getFingerprint } = require('../lib/crypto');

const CONeko_DIR = path.join(require('os').homedir(), '.coneko');
const KEYS_FILE = path.join(CONeko_DIR, 'keys.json');

async function register(address, options) {
  const spinner = ora(`Registering ${address}...`).start();
  
  try {
    // Parse address
    const [username, domain = 'coneko.ai'] = address.split('@');
    if (!username) {
      spinner.fail('Invalid address format. Use: username@domain');
      return;
    }

    // Load keys
    if (!await fs.pathExists(KEYS_FILE)) {
      spinner.fail('Agent not initialized. Run: coneko init');
      return;
    }
    
    const keys = await fs.readJson(KEYS_FILE);
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
    
    // Register
    const response = await axios.post(
      `${relayUrl}/v1/registry/register`,
      {
        username,
        domain,
        fingerprint,
        public_key: keys.keys.encryptionPublic,
        relay_url: options.relayUrl || keys.relay || '',
        signature
      },
      { timeout: 30000 }
    );
    
    spinner.succeed(`Registered: ${response.data.address}`);
    console.log(chalk.green(`  Fingerprint: ${response.data.fingerprint}`));
    
    // Save to local contacts for self-reference
    const contactsFile = path.join(CONeko_DIR, 'contacts.json');
    const contacts = await fs.pathExists(contactsFile) 
      ? await fs.readJson(contactsFile) 
      : { contacts: {} };
    
    contacts.contacts[fingerprint] = {
      agentId: keys.agentId,
      name: `${username}@${domain}`,
      publicKey: keys.keys.encryptionPublic,
      relay: relayUrl,
      trusted: true,
      isSelf: true
    };
    
    await fs.writeJson(contactsFile, contacts, { spaces: 2 });
    
  } catch (err) {
    spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}

async function resolve(address, options) {
  const spinner = ora(`Resolving ${address}...`).start();
  
  try {
    // Parse address
    const [username, domain = 'coneko.ai'] = address.split('@');
    if (!username) {
      spinner.fail('Invalid address format');
      return;
    }
    
    // Determine relay
    const relayUrl = options.relay || `https://${domain}`;
    
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
    if (options.add) {
      const contactsFile = path.join(CONeko_DIR, 'contacts.json');
      const contacts = await fs.pathExists(contactsFile) 
        ? await fs.readJson(contactsFile) 
        : { contacts: {} };
      
      contacts.contacts[response.data.fingerprint] = {
        agentId: `agent_${response.data.fingerprint.substring(0, 12)}`,
        name: `${username}@${domain}`,
        publicKey: response.data.public_key,
        relay: response.data.relay_url,
        trusted: true,
        added: new Date().toISOString()
      };
      
      await fs.writeJson(contactsFile, contacts, { spaces: 2 });
      console.log(chalk.green('\n  ✓ Added to contacts'));
    }
    
  } catch (err) {
    if (err.response?.status === 404) {
      spinner.fail(`User not found: ${address}`);
    } else {
      spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    }
    process.exit(1);
  }
}

async function whois(fingerprint, options) {
  const spinner = ora(`Looking up ${fingerprint}...`).start();
  
  try {
    const relayUrl = options.relay || 'https://coneko.ai';
    
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
    
  } catch (err) {
    spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}

module.exports = { register, resolve, whois };
