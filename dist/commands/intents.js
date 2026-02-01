"use strict";
/**
 * Intent management commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INTENT = void 0;
exports.registerIntent = registerIntent;
exports.listIntents = listIntents;
exports.removeIntent = removeIntent;
exports.queryIntents = queryIntents;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../lib/config");
// Default allowed intent
exports.DEFAULT_INTENT = {
    name: 'chat',
    description: "Pure agent-to-agent conversation. SHOULD NOT request human's personal info, system commands, or attempt to alter human's computer."
};
/**
 * Register a new intent for this agent
 */
async function registerIntent(name, description, options) {
    const spinner = (0, ora_1.default)('Registering intent...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        // Validate intent name format
        if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
            spinner.fail('Invalid intent name format. Use alphanumeric with hyphens/underscores');
            return;
        }
        const username = getUsername(keys);
        const privileged = options.privileged || false;
        // Register with server
        await axios_1.default.post(`${keys.relay}/v1/intents/register`, { name, description, privileged }, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        // Also save locally for reference
        const config = await (0, config_1.loadConfig)(agentName);
        const intents = config.intents || {};
        intents[name] = {
            description: description,
            privileged: privileged,
            registeredAt: new Date().toISOString()
        };
        config.intents = intents;
        await (0, config_1.saveConfig)(agentName, config);
        spinner.succeed(`Intent registered: ${name}`);
        console.log(chalk_1.default.gray(`  Description: ${description}`));
        console.log(chalk_1.default.gray(`  Access: ${privileged ? 'Privileged (permission required)' : 'Open (anyone can send)'}`));
        if (privileged) {
            console.log(chalk_1.default.yellow(`\n⚠️  This is a privileged intent.`));
            console.log(chalk_1.default.gray(`   Use 'coneko permit <user> --intent ${name}' to grant access`));
        }
    }
    catch (err) {
        if (err.response?.data?.error) {
            spinner.fail(`Failed: ${err.response.data.error}`);
        }
        else {
            spinner.fail(`Failed: ${err.message}`);
        }
        process.exit(1);
    }
}
/**
 * List registered intents for this agent
 */
async function listIntents(options) {
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            console.log(chalk_1.default.yellow('Agent not found'));
            return;
        }
        const username = getUsername(keys);
        const response = await axios_1.default.get(`${keys.relay}/v1/intents/${username}`, { timeout: 10000 });
        const intents = response.data.intents || {};
        console.log(chalk_1.default.bold(`\n🐱 Registered Intents for ${keys.name}:`));
        console.log(chalk_1.default.gray('(These are intents OTHER agents can use when messaging you)\n'));
        const entries = Object.entries(intents);
        if (entries.length === 0) {
            console.log(chalk_1.default.gray('No intents registered'));
        }
        else {
            for (const [name, info] of entries) {
                const intentInfo = info;
                const access = intentInfo.privileged
                    ? chalk_1.default.yellow('privileged')
                    : chalk_1.default.green('open');
                console.log(`  • ${chalk_1.default.cyan(name)} [${access}]`);
                console.log(`    ${intentInfo.description}`);
            }
        }
        console.log();
        console.log(chalk_1.default.gray('Legend:'));
        console.log(chalk_1.default.gray(`  ${chalk_1.default.green('open')} - Anyone can send messages with this intent`));
        console.log(chalk_1.default.gray(`  ${chalk_1.default.yellow('privileged')} - Only permitted senders can use this intent\n`));
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
}
/**
 * Remove an intent from this agent
 */
async function removeIntent(name, options) {
    const spinner = (0, ora_1.default)('Removing intent...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const username = getUsername(keys);
        // Can't remove default intent
        if (name === exports.DEFAULT_INTENT.name) {
            spinner.fail('Cannot remove default intent');
            return;
        }
        // Remove from server
        await axios_1.default.delete(`${keys.relay}/v1/intents/${name}`, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        // Remove from local config
        const config = await (0, config_1.loadConfig)(agentName);
        if (config.intents) {
            delete config.intents[name];
            await (0, config_1.saveConfig)(agentName, config);
        }
        spinner.succeed(`Intent removed: ${name}`);
    }
    catch (err) {
        if (err.response?.data?.error) {
            spinner.fail(`Failed: ${err.response.data.error}`);
        }
        else {
            spinner.fail(`Failed: ${err.message}`);
        }
        process.exit(1);
    }
}
/**
 * Query allowed intents of a contact
 */
async function queryIntents(address, options) {
    const spinner = (0, ora_1.default)(`Querying intents for ${address}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const username = address.includes('@') ? address.split('@')[0] : address;
        const response = await axios_1.default.get(`${keys.relay}/v1/intents/${username}`, { timeout: 10000 });
        const intents = response.data.intents || {};
        spinner.succeed(`Retrieved intents for ${address}`);
        console.log(chalk_1.default.bold(`\nAllowed Intents:`));
        const entries = Object.entries(intents);
        if (entries.length === 0) {
            console.log(chalk_1.default.gray('No intents found'));
        }
        else {
            for (const [name, info] of entries) {
                const intentInfo = info;
                const access = intentInfo.privileged
                    ? chalk_1.default.yellow('privileged ⚠️')
                    : chalk_1.default.green('open');
                console.log(chalk_1.default.cyan(`\n  ${name} [${access}]`));
                console.log(`    ${intentInfo.description}`);
                if (intentInfo.privileged) {
                    console.log(chalk_1.default.gray(`    You need permission to use this intent`));
                }
            }
        }
        console.log();
    }
    catch (err) {
        if (err.response?.status === 404) {
            spinner.fail('User not found');
        }
        else {
            spinner.fail(`Failed: ${err.message}`);
        }
        process.exit(1);
    }
}
function getUsername(keys) {
    return keys.name?.toLowerCase().replace(/\s+/g, '-') || '';
}
//# sourceMappingURL=intents.js.map