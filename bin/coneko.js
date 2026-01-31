#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

const identity = require('./commands/identity');
const contacts = require('./commands/contacts');
const messages = require('./commands/messages');
const gateway = require('./commands/gateway');
const mail = require('./commands/mail');
const registry = require('./commands/registry');

program
  .name('coneko')
  .description('Coneko - Agent-to-Agent Network Protocol')
  .version(pkg.version);

// Identity commands
program
  .command('init')
  .description('Initialize a new agent identity')
  .requiredOption('-n, --name <name>', 'Agent name')
  .option('-r, --relay <url>', 'Relay URL', 'https://api.coneko.ai')
  .action(identity.init);

program
  .command('whoami')
  .description('Show current agent identity')
  .action(identity.whoami);

// Registry commands (DNS-style addressing)
program
  .command('register <address>')
  .description('Register username@domain on relay')
  .option('-r, --relay <url>', 'Relay URL override')
  .option('--relay-url <url>', 'Your public relay URL (if different)')
  .action(registry.register);

program
  .command('resolve <address>')
  .description('Resolve username@domain to fingerprint')
  .option('-r, --relay <url>', 'Relay URL override')
  .option('-a, --add', 'Auto-add to contacts')
  .action(registry.resolve);

program
  .command('whois <fingerprint>')
  .description('Reverse lookup: find addresses by fingerprint')
  .option('-r, --relay <url>', 'Relay URL override')
  .action(registry.whois);

// Contact commands
program
  .command('qr-show')
  .description('Generate QR code for contact sharing')
  .option('-o, --output <file>', 'Output file path')
  .action(contacts.qrShow);

program
  .command('qr-scan <image>')
  .description('Scan QR code and add contact')
  .option('-n, --name <name>', 'Contact name override')
  .action(contacts.qrScan);

program
  .command('contacts')
  .description('List all contacts')
  .action(contacts.list);

program
  .command('block <fingerprint>')
  .description('Block a contact')
  .action(contacts.block);

// Message commands
program
  .command('send')
  .description('Send a message to a contact')
  .requiredOption('-t, --to <address>', 'Recipient (fingerprint or username@domain)')
  .requiredOption('-i, --intent <uri>', 'Intent URI')
  .requiredOption('-c, --content <json>', 'Message content (JSON)')
  .option('-m, --message <text>', 'Human-readable message')
  .action(async (options) => {
    // If to looks like an address (has @), resolve it first
    if (options.to.includes('@')) {
      const chalk = require('chalk');
      console.log(chalk.gray(`Resolving ${options.to}...`));
      await registry.resolve(options.to, { add: false });
    }
    await messages.send(options);
  });

program
  .command('poll')
  .description('Poll for new messages from relay')
  .option('--no-ack', 'Do not auto-acknowledge messages')
  .action(messages.poll);

program
  .command('decrypt <file>')
  .description('Decrypt and verify a message file')
  .action(messages.decrypt);

// Gateway setup
program
  .command('setup-gateway')
  .description('Setup coneko-gateway agent in Clawdbot')
  .action(gateway.setup);

// Mail check (with audit)
program
  .command('check-mail')
  .description('Check mail with audit gateway')
  .option('-l, --limit <n>', 'Maximum messages to fetch', '10')
  .action(mail.check);

// Helper for address resolution
program
  .command('send-to <address>')
  .description('Send to username@domain (convenience)')
  .requiredOption('-i, --intent <uri>', 'Intent URI')
  .requiredOption('-c, --content <json>', 'Message content')
  .option('-m, --message <text>', 'Human-readable message')
  .action(async (address, options) => {
    // Resolve address
    const resolved = await registry.resolve(address, { add: true });
    if (resolved) {
      options.to = resolved.fingerprint;
      await messages.send(options);
    }
  });

program.parse();
