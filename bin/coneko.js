#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

const identity = require('../src/commands/identity');
const contacts = require('../src/commands/contacts');
const messages = require('../src/commands/messages');
const gateway = require('../src/commands/gateway');
const mail = require('../src/commands/mail');
const registry = require('../src/commands/registry');
const intents = require('../src/commands/intents');
const settings = require('../src/commands/settings');

program
  .name('coneko')
  .description('Coneko - Agent-to-Agent Network Protocol')
  .version(pkg.version);

// Global agent option
program.option('-a, --agent <name>', 'Agent name (default: uses CONEKO_AGENT env or "default")');

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
  .option('-a, --agent <name>', 'Agent name')
  .action(identity.whoami);

program
  .command('list-agents')
  .description('List all coneko agents on this machine')
  .action(async () => {
    const { listAgents } = require('./lib/config');
    const agents = await listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents found. Run: coneko init -n <name>'));
      return;
    }
    console.log(chalk.bold('\n🐱 Coneko Agents:'));
    for (const agent of agents) {
      console.log(`  • ${agent}`);
    }
    console.log();
  });

// Intent commands (decentralized permissions)
program
  .command('intent-register <uri> <description>')
  .description('Register an intent that other agents can use when messaging you')
  .option('-a, --agent <name>', 'Agent name')
  .option('--risk <level>', 'Risk level (low/medium/high)', 'medium')
  .option('--auto-approve', 'Auto-approve messages with this intent', false)
  .action(intents.registerIntent);

program
  .command('intent-list')
  .description('List intents you have registered (what others can use)')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.listIntents);

program
  .command('intent-remove <uri>')
  .description('Remove a registered intent')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.removeIntent);

program
  .command('intent-query <address>')
  .description('Query what intents a contact allows')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.queryIntents);

// Discoverability commands
program
  .command('discoverable')
  .description('Make your account discoverable by search')
  .option('-a, --agent <name>', 'Agent name')
  .action((options) => settings.setDiscoverable(true, options));

program
  .command('undiscoverable')
  .description('Hide your account from search')
  .option('-a, --agent <name>', 'Agent name')
  .action((options) => settings.setDiscoverable(false, options));

program
  .command('discoverability')
  .description('Check your account discoverability status')
  .option('-a, --agent <name>', 'Agent name')
  .action(settings.getDiscoverable);

program
  .command('search-accounts <query>')
  .description('Search for discoverable accounts')
  .option('-a, --agent <name>', 'Agent name')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(settings.searchAccounts);

// Metrics
// Registry commands (DNS-style addressing)
program
  .command('register <address>')
  .description('Register username@domain on relay')
  .option('-a, --agent <name>', 'Agent name')
  .option('-r, --relay <url>', 'Relay URL override')
  .option('--relay-url <url>', 'Your public relay URL (if different)')
  .option('--discoverable', 'Make account discoverable by search', false)
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

// Contact / Friend commands
program
  .command('search <query>')
  .description('Search for an account by username@domain or fingerprint')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.search);

program
  .command('friend-request <address>')
  .description('Send a friend request to an account')
  .option('-a, --agent <name>', 'Agent name')
  .option('-m, --message <text>', 'Personal message with request')
  .action(contacts.requestFriend);

program
  .command('invitations')
  .description('List friend invitations (received and sent)')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.invitations);

program
  .command('friend-accept <fingerprint>')
  .description('Accept a friend request')
  .option('-a, --agent <name>', 'Agent name')
  .option('-n, --name <name>', 'Contact name')
  .action(contacts.acceptFriend);

program
  .command('friend-reject <fingerprint>')
  .description('Reject a friend request')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.rejectFriend);

program
  .command('contacts')
  .description('List all contacts')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.list);

program
  .command('contact-remove <fingerprint>')
  .description('Remove a contact')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.remove);

program
  .command('block <fingerprint>')
  .description('Block a contact or fingerprint')
  .option('-a, --agent <name>', 'Agent name')
  .option('-n, --name <name>', 'Name for blocked contact')
  .action(contacts.block);

// Message commands
program
  .command('send')
  .description('Send a message to a contact (intents checked against recipient allowlist)')
  .requiredOption('-t, --to <address>', 'Recipient (fingerprint or username@domain)')
  .requiredOption('-i, --intent <uris>', 'Intent URI(s), comma-separated for multiple')
  .requiredOption('-c, --content <json>', 'Message content (JSON)')
  .option('-a, --agent <name>', 'Agent name')
  .option('-m, --message <text>', 'Human-readable message')
  .action(async (options) => {
    // If to looks like an address (has @), resolve it first
    if (options.to.includes('@')) {
      console.log(chalk.gray(`Resolving ${options.to}...`));
      await registry.resolve(options.to, { add: false });
    }
    const result = await messages.send(options);
    
    // Handle bounced messages
    if (result?.bounced) {
      console.log(chalk.yellow('\n💡 To send this message, request intent approval:'));
      console.log(chalk.gray('   Ask your human to contact the recipient\'s human.'));
    }
  });

program
  .command('poll')
  .description('Poll for new messages from relay')
  .option('-a, --agent <name>', 'Agent name')
  .option('--no-ack', 'Do not auto-acknowledge messages')
  .option('-l, --limit <n>', 'Maximum messages to fetch', '10')
  .action(mail.check);

// Gateway setup
program
  .command('setup-openclaw')
  .description('Setup coneko-gateway agent in OpenClaw')
  .option('-a, --agent <name>', 'Link to specific coneko agent')
  .action(gateway.setup);

// Helper for address resolution
program
  .command('send-to <address>')
  .description('Send to username@domain (convenience)')
  .requiredOption('-i, --intent <uris>', 'Intent URI(s), comma-separated')
  .requiredOption('-c, --content <json>', 'Message content')
  .option('-a, --agent <name>', 'Agent name')
  .option('-m, --message <text>', 'Human-readable message')
  .action(async (address, options) => {
    // Resolve address
    const resolved = await registry.resolve(address, { add: true });
    if (resolved) {
      options.to = resolved.fingerprint;
      const result = await messages.send(options);
      if (result?.bounced) {
        console.log(chalk.yellow('\n💡 Request intent approval from recipient'));
      }
    }
  });

program.parse();
