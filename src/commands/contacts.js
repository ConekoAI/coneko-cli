const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { loadKeys, getAgentPaths, ensureAgentDirs } = require('../lib/config');

/**
 * Search for an account by ID (username or fingerprint)
 * @param {string} query - Username@domain or fingerprint
 * @param {Object} options - Options
 */
async function search(query, options) {
  const spinner = ora(`Searching for ${query}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    let result;
    
    if (query.includes('@')) {
      // Search by username@domain
      const response = await axios.get(
        `${keys.relay}/v1/registry/lookup/${query}`,
        { timeout: 10000 }
      );
      result = response.data;
    } else {
      // Search by fingerprint
      const response = await axios.get(
        `${keys.relay}/v1/registry/reverse/${query}`,
        { timeout: 10000 }
      );
      result = response.data;
    }
    
    spinner.succeed('Account found');
    
    console.log(chalk.bold('\n🐱 Account:'));
    console.log(`  Address: ${chalk.cyan(result.address || query)}`);
    console.log(`  Fingerprint: ${result.fingerprint}`);
    console.log(`  Name: ${result.name || 'Not provided'}`);
    console.log(`  Relay: ${result.relay || keys.relay}`);
    
    // Query their allowed intents
    try {
      const intentResponse = await axios.get(
        `${keys.relay}/v1/intents/${result.fingerprint}`,
        { timeout: 10000 }
      );
      const intents = intentResponse.data.intents || {};
      const intentList = Object.keys(intents);
      
      if (intentList.length > 0) {
        console.log(chalk.cyan('\n  Allowed Intents:'));
        for (const intent of intentList) {
          console.log(`    • ${intent}`);
        }
      }
    } catch (e) {
      // Intents may not be public
    }
    
    return result;
    
  } catch (err) {
    if (err.response?.status === 404) {
      spinner.fail('Account not found');
    } else {
      spinner.fail(`Search failed: ${err.message}`);
    }
    return null;
  }
}

/**
 * Send a friend request to an account
 * @param {string} address - Username@domain or fingerprint
 * @param {Object} options - Options
 */
async function requestFriend(address, options) {
  const spinner = ora(`Sending friend request to ${address}...`).start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const paths = getAgentPaths(agentName);
    
    // Resolve address to fingerprint if needed
    let fingerprint = address;
    if (address.includes('@')) {
      const response = await axios.get(
        `${keys.relay}/v1/registry/lookup/${address}`,
        { timeout: 10000 }
      );
      fingerprint = response.data.fingerprint;
    }
    
    // Send friend request via relay
    const response = await axios.post(
      `${keys.relay}/v1/contacts/request`,
      {
        recipient: fingerprint,
        sender: {
          fingerprint: keys.fingerprint,
          name: keys.name,
          address: options.address || null  // Our registered address
        },
        message: options.message || `Hello! I'd like to add you as a contact.`
      },
      {
        headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
        timeout: 30000
      }
    );
    
    spinner.succeed('Friend request sent');
    
    // Save pending request locally
    const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {}, pending: {} }));
    contacts.pending[fingerprint] = {
      name: address,
      sentAt: new Date().toISOString(),
      status: 'pending'
    };
    await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    
    console.log(chalk.gray(`  Request ID: ${response.data.requestId}`));
    console.log(chalk.gray(`  Status: Waiting for acceptance`));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response?.data?.error) {
      console.error(chalk.red(`  ${err.response.data.error}`));
    }
    process.exit(1);
  }
}

/**
 * List friend invitations (received and sent)
 * @param {Object} options - Options
 */
async function invitations(options) {
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      console.log(chalk.yellow('Agent not found'));
      return;
    }
    
    const paths = getAgentPaths(agentName);
    
    // Fetch from relay
    const response = await axios.get(
      `${keys.relay}/v1/contacts/invitations`,
      {
        headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
        timeout: 10000
      }
    );
    
    const { received = [], sent = [] } = response.data;
    
    console.log(chalk.bold('\n🐱 Friend Invitations\n'));
    
    // Received invitations
    if (received.length > 0) {
      console.log(chalk.cyan('Received:'));
      for (const inv of received) {
        console.log(`  • From: ${chalk.green(inv.sender.name || inv.sender.fingerprint)}`);
        console.log(`    Fingerprint: ${inv.sender.fingerprint}`);
        console.log(`    Message: "${inv.message}"`);
        console.log(`    Received: ${new Date(inv.createdAt).toLocaleString()}`);
        console.log(chalk.gray(`    Accept: coneko contact-accept ${inv.sender.fingerprint}`));
        console.log();
      }
    } else {
      console.log(chalk.gray('No received invitations\n'));
    }
    
    // Sent invitations
    if (sent.length > 0) {
      console.log(chalk.cyan('Sent (pending):'));
      for (const inv of sent) {
        console.log(`  • To: ${chalk.yellow(inv.recipient.name || inv.recipient.fingerprint)}`);
        console.log(`    Status: ${inv.status}`);
        console.log(`    Sent: ${new Date(inv.sentAt).toLocaleString()}`);
        console.log();
      }
    }
    
    if (received.length === 0 && sent.length === 0) {
      console.log(chalk.gray('No invitations. Find friends with: coneko search <address>'));
    }
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Accept a friend invitation
 * @param {string} fingerprint - Sender's fingerprint
 * @param {Object} options - Options
 */
async function acceptFriend(fingerprint, options) {
  const spinner = ora('Accepting friend request...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    const paths = getAgentPaths(agentName);
    
    // Accept via relay
    const response = await axios.post(
      `${keys.relay}/v1/contacts/accept`,
      { sender: fingerprint },
      {
        headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
        timeout: 30000
      }
    );
    
    const contactInfo = response.data.contact;
    
    // Save to local contacts
    const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {}, pending: {} }));
    
    contacts.contacts[fingerprint] = {
      agentId: contactInfo.agentId,
      name: options.name || contactInfo.name || fingerprint,
      publicKey: contactInfo.publicKey,
      relay: contactInfo.relay,
      address: contactInfo.address,
      trusted: true,
      added: new Date().toISOString()
    };
    
    // Remove from pending if exists
    if (contacts.pending[fingerprint]) {
      delete contacts.pending[fingerprint];
    }
    
    await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    
    spinner.succeed('Friend request accepted');
    console.log(chalk.green(`  Added: ${contacts.contacts[fingerprint].name}`));
    console.log(chalk.gray(`  Fingerprint: ${fingerprint}`));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    if (err.response?.data?.error) {
      console.error(chalk.red(`  ${err.response.data.error}`));
    }
    process.exit(1);
  }
}

/**
 * Reject/decline a friend invitation
 * @param {string} fingerprint - Sender's fingerprint
 * @param {Object} options - Options
 */
async function rejectFriend(fingerprint, options) {
  const spinner = ora('Rejecting friend request...').start();
  
  try {
    const agentName = options.agent;
    const keys = await loadKeys(agentName);
    if (!keys) {
      spinner.fail('Agent not found');
      return;
    }
    
    // Reject via relay
    await axios.post(
      `${keys.relay}/v1/contacts/reject`,
      { sender: fingerprint },
      {
        headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
        timeout: 30000
      }
    );
    
    spinner.succeed('Friend request rejected');
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * List all contacts
 * @param {Object} options - Options
 */
async function list(options) {
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    
    if (!await fs.pathExists(paths.contactsFile)) {
      console.log(chalk.yellow('No contacts yet'));
      console.log(chalk.gray('Find friends: coneko search <address>'));
      return;
    }
    
    const contacts = await fs.readJson(paths.contactsFile);
    const list = Object.entries(contacts.contacts || {});
    const pending = Object.entries(contacts.pending || {});
    
    console.log(chalk.bold('\n🐱 Contacts\n'));
    
    if (list.length === 0) {
      console.log(chalk.gray('No confirmed contacts\n'));
    } else {
      console.log(chalk.cyan('Confirmed:'));
      for (const [fp, info] of list) {
        const status = info.trusted ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${chalk.bold(info.name)}`);
        console.log(`    ${chalk.gray(fp)}`);
        if (info.address) console.log(`    ${chalk.gray(info.address)}`);
        console.log();
      }
    }
    
    if (pending.length > 0) {
      console.log(chalk.cyan('Pending Requests:'));
      for (const [fp, info] of pending) {
        console.log(`  ⏳ ${chalk.yellow(info.name || fp)}`);
        console.log(`    Sent: ${new Date(info.sentAt).toLocaleDateString()}`);
        console.log();
      }
    }
    
    console.log(chalk.gray('Manage invitations: coneko invitations'));
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Remove a contact
 * @param {string} fingerprint - Contact's fingerprint
 * @param {Object} options - Options
 */
async function remove(fingerprint, options) {
  const spinner = ora('Removing contact...').start();
  
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    
    const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {} }));
    
    if (!contacts.contacts[fingerprint]) {
      spinner.fail('Contact not found');
      return;
    }
    
    const name = contacts.contacts[fingerprint].name;
    delete contacts.contacts[fingerprint];
    
    await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    
    spinner.succeed(`Removed: ${name}`);
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Block a contact
 * @param {string} fingerprint - Contact's fingerprint
 * @param {Object} options - Options
 */
async function block(fingerprint, options) {
  const spinner = ora('Blocking contact...').start();
  
  try {
    const agentName = options.agent;
    const paths = getAgentPaths(agentName);
    const keys = await loadKeys(agentName);
    
    const contacts = await fs.readJson(paths.contactsFile).catch(() => ({ contacts: {} }));
    
    if (contacts.contacts[fingerprint]) {
      contacts.contacts[fingerprint].trusted = false;
      contacts.contacts[fingerprint].blocked = true;
    } else {
      // Block by fingerprint even if not in contacts
      contacts.contacts[fingerprint] = {
        name: options.name || fingerprint,
        blocked: true,
        trusted: false,
        added: new Date().toISOString()
      };
    }
    
    await fs.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    
    // Also notify relay
    try {
      await axios.post(
        `${keys.relay}/v1/contacts/block`,
        { fingerprint },
        {
          headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
          timeout: 10000
        }
      );
    } catch (e) {
      // Non-critical
    }
    
    spinner.succeed(`Blocked: ${fingerprint}`);
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  search,
  requestFriend,
  invitations,
  acceptFriend,
  rejectFriend,
  list,
  remove,
  block
};
