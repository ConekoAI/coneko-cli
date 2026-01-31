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
const permissions = require('../src/commands/permissions');
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
  .command('intent-register <name> <description>')
  .description('Register an intent that other agents can use when messaging you')
  .option('-a, --agent <name>', 'Agent name')
  .option('--privileged', 'Make this intent privileged (requires explicit permission)', false)
  .action(intents.registerIntent);

program
  .command('intent-list')
  .description('List intents you have registered (what others can use)')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.listIntents);

program
  .command('intent-remove <name>')
  .description('Remove a registered intent')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.removeIntent);

program
  .command('intent-query <address>')
  .description('Query what intents a contact allows')
  .option('-a, --agent <name>', 'Agent name')
  .action(intents.queryIntents);

// Permission commands (NEW - replacing friend requests)
program
  .command('permit <grantee>')
  .description('Grant permission to a user for a privileged intent')
  .requiredOption('-i, --intent <name>', 'Intent to grant permission for')
  .option('-a, --agent <name>', 'Agent name')
  .action(permissions.grantPermission);

program
  .command('revoke <grantee>')
  .description('Revoke permission from a user')
  .requiredOption('-i, --intent <name>', 'Intent to revoke permission for')
  .option('-a, --agent <name>', 'Agent name')
  .action(permissions.revokePermission);

program
  .command('permissions')
  .description('List permissions you have granted')
  .option('-a, --agent <name>', 'Agent name')
  .action(permissions.listGrantedPermissions);

program
  .command('permissions-received')
  .description('List permissions you have received (what privileged intents you can use)')
  .option('-a, --agent <name>', 'Agent name')
  .action(permissions.listReceivedPermissions);

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

// Contact commands (simplified - just metadata)
program
  .command('search <query>')
  .description('Search for an account by username@domain or fingerprint')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.search);

program
  .command('contacts')
  .description('List all contacts (metadata only)')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.list);

program
  .command('contact-add <address>')
  .description('Add a contact with optional name/notes (metadata only)')
  .option('-a, --agent <name>', 'Agent name')
  .option('-n, --name <displayName>', 'Display name for contact')
  .option('--notes <text>', 'Notes about contact')
  .action(contacts.add);

program
  .command('contact-remove <address>')
  .description('Remove a contact')
  .option('-a, --agent <name>', 'Agent name')
  .action(contacts.remove);

// Message commands
program
  .command('send')
  .description('Send a message to a contact (intents checked against recipient allowlist)')
  .requiredOption('-t, --to <address>', 'Recipient (username@domain)')
  .requiredOption('-i, --intent <uris>', 'Intent URI(s), comma-separated for multiple')
  .requiredOption('-c, --content <json>', 'Message content (JSON)')
  .option('-a, --agent <name>', 'Agent name')
  .option('-m, --message <text>', 'Human-readable message')
  .action(async (options) => {
    const result = await messages.send(options);
    
    // Handle bounced messages
    if (result?.bounced) {
      console.log(chalk.yellow('\n💡 To send this message:'));
      console.log(chalk.gray('   - If intent is privileged: ask recipient to grant permission'));
      console.log(chalk.gray('   - If intent not registered: ask recipient to register it'));
    }
  });

program
  .command('poll')
  .description('Poll for new messages from relay')
  .option('-a, --agent <name>', 'Agent name')
  .option('--no-ack', 'Do not auto-acknowledge messages')
  .option('-l, --limit <n>', 'Maximum messages to fetch', '10')
  .option('-d, --decrypt', 'Decrypt messages immediately for easier human audit', false)
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
    options.to = address;
    const result = await messages.send(options);
    if (result?.bounced) {
      console.log(chalk.yellow('\n💡 Request intent permission from recipient'));
    }
  });

program.parse();
