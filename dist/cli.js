"use strict";
/**
 * Coneko CLI - Main entry point
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const pkg = __importStar(require("../package.json"));
const identity = __importStar(require("./commands/identity"));
const contacts = __importStar(require("./commands/contacts"));
const messages = __importStar(require("./commands/messages"));
const gateway = __importStar(require("./commands/gateway"));
const mail = __importStar(require("./commands/mail"));
const registry = __importStar(require("./commands/registry"));
const intents = __importStar(require("./commands/intents"));
const permissions = __importStar(require("./commands/permissions"));
const settings = __importStar(require("./commands/settings"));
const config_1 = require("./lib/config");
commander_1.program
    .name('coneko')
    .description('Coneko - Agent-to-Agent Network Protocol')
    .version(pkg.version);
// Global agent option
commander_1.program.option('-a, --agent <name>', 'Agent name (default: uses CONEKO_AGENT env or "default")');
// Identity commands
commander_1.program
    .command('init')
    .description('Initialize a new agent identity')
    .requiredOption('-n, --name <name>', 'Agent name')
    .option('-r, --relay <url>', 'Relay URL', 'https://api.coneko.ai')
    .action(identity.init);
commander_1.program
    .command('whoami')
    .description('Show current agent identity')
    .option('-a, --agent <name>', 'Agent name')
    .action(identity.whoami);
commander_1.program
    .command('list-agents')
    .description('List all coneko agents on this machine')
    .action(async () => {
    const agents = await (0, config_1.listAgents)();
    if (agents.length === 0) {
        console.log(chalk_1.default.yellow('No agents found. Run: coneko init -n <name>'));
        return;
    }
    console.log(chalk_1.default.bold('\n🐱 Coneko Agents:'));
    for (const agent of agents) {
        console.log(`  • ${agent}`);
    }
    console.log();
});
// Intent commands
commander_1.program
    .command('intent-register <name> <description>')
    .description('Register an intent that other agents can use when messaging you')
    .option('-a, --agent <name>', 'Agent name')
    .option('--privileged', 'Make this intent privileged (requires explicit permission)', false)
    .action(intents.registerIntent);
commander_1.program
    .command('intent-list')
    .description('List intents you have registered (what others can use)')
    .option('-a, --agent <name>', 'Agent name')
    .action(intents.listIntents);
commander_1.program
    .command('intent-remove <name>')
    .description('Remove a registered intent')
    .option('-a, --agent <name>', 'Agent name')
    .action(intents.removeIntent);
commander_1.program
    .command('intent-query <address>')
    .description('Query what intents a contact allows')
    .option('-a, --agent <name>', 'Agent name')
    .action(intents.queryIntents);
// Permission commands
commander_1.program
    .command('permit <grantee>')
    .description('Grant permission to a user for a privileged intent')
    .requiredOption('-i, --intent <name>', 'Intent to grant permission for')
    .option('-a, --agent <name>', 'Agent name')
    .action(permissions.grantPermission);
commander_1.program
    .command('revoke <grantee>')
    .description('Revoke permission from a user')
    .requiredOption('-i, --intent <name>', 'Intent to revoke permission for')
    .option('-a, --agent <name>', 'Agent name')
    .action(permissions.revokePermission);
commander_1.program
    .command('permissions')
    .description('List permissions you have granted')
    .option('-a, --agent <name>', 'Agent name')
    .action(permissions.listGrantedPermissions);
commander_1.program
    .command('permissions-received')
    .description('List permissions you have received (what privileged intents you can use)')
    .option('-a, --agent <name>', 'Agent name')
    .action(permissions.listReceivedPermissions);
// Discoverability commands
commander_1.program
    .command('discoverable')
    .description('Make your account discoverable by search')
    .option('-a, --agent <name>', 'Agent name')
    .action((options) => settings.setDiscoverable(true, options));
commander_1.program
    .command('undiscoverable')
    .description('Hide your account from search')
    .option('-a, --agent <name>', 'Agent name')
    .action((options) => settings.setDiscoverable(false, options));
commander_1.program
    .command('discoverability')
    .description('Check your account discoverability status')
    .option('-a, --agent <name>', 'Agent name')
    .action(settings.getDiscoverable);
commander_1.program
    .command('search-accounts <query>')
    .description('Search for discoverable accounts')
    .option('-a, --agent <name>', 'Agent name')
    .option('-l, --limit <n>', 'Max results', '20')
    .action(settings.searchAccounts);
// Registry commands
commander_1.program
    .command('register <address>')
    .description('Register username@domain on relay')
    .option('-a, --agent <name>', 'Agent name')
    .option('-r, --relay <url>', 'Relay URL override')
    .option('--relay-url <url>', 'Your public relay URL (if different)')
    .option('--discoverable', 'Make account discoverable by search', false)
    .action(registry.register);
commander_1.program
    .command('resolve <address>')
    .description('Resolve username@domain to fingerprint')
    .option('-r, --relay <url>', 'Relay URL override')
    .option('-a, --add', 'Auto-add to contacts')
    .action(registry.resolve);
commander_1.program
    .command('whois <fingerprint>')
    .description('Reverse lookup: find addresses by fingerprint')
    .option('-r, --relay <url>', 'Relay URL override')
    .action(registry.whois);
// Contact commands
commander_1.program
    .command('search <query>')
    .description('Search for an account by username@domain or fingerprint')
    .option('-a, --agent <name>', 'Agent name')
    .action(contacts.search);
commander_1.program
    .command('contacts')
    .description('List all contacts (metadata only)')
    .option('-a, --agent <name>', 'Agent name')
    .action(contacts.list);
commander_1.program
    .command('contact-add <address>')
    .description('Add a contact with optional name/notes (metadata only)')
    .option('-a, --agent <name>', 'Agent name')
    .option('-n, --name <displayName>', 'Display name for contact')
    .option('--notes <text>', 'Notes about contact')
    .action(contacts.add);
commander_1.program
    .command('contact-remove <address>')
    .description('Remove a contact')
    .option('-a, --agent <name>', 'Agent name')
    .action(contacts.remove);
// Message commands
commander_1.program
    .command('send')
    .description('Send a message to a contact (intents checked against recipient allowlist)')
    .requiredOption('-t, --to <address>', 'Recipient (username@domain)')
    .requiredOption('-i, --intent <uris>', 'Intent URI(s), comma-separated for multiple')
    .requiredOption('-c, --content <json>', 'Message content (JSON)')
    .option('-a, --agent <name>', 'Agent name')
    .option('-m, --message <text>', 'Human-readable message')
    .action(async (options) => {
    const result = await messages.send(options);
    if (result?.bounced) {
        console.log(chalk_1.default.yellow('\n💡 To send this message:'));
        console.log(chalk_1.default.gray('   - If intent is privileged: ask recipient to grant permission'));
        console.log(chalk_1.default.gray('   - If intent not registered: ask recipient to register it'));
    }
});
commander_1.program
    .command('poll')
    .description('Poll for new messages from relay')
    .option('-a, --agent <name>', 'Agent name')
    .option('--no-ack', 'Do not auto-acknowledge messages')
    .option('-l, --limit <n>', 'Maximum messages to fetch', '10')
    .option('-d, --decrypt', 'Decrypt messages immediately for easier human audit', false)
    .action(async (options) => { await mail.check(options); });
// Gateway setup
commander_1.program
    .command('setup-openclaw')
    .description('Setup coneko-gateway agent in OpenClaw')
    .option('-a, --agent <name>', 'Link to specific coneko agent')
    .action(gateway.setup);
// Helper for address resolution
commander_1.program
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
        console.log(chalk_1.default.yellow('\n💡 Request intent permission from recipient'));
    }
});
commander_1.program.parse();
//# sourceMappingURL=cli.js.map