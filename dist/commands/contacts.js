"use strict";
/**
 * Contact management commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = search;
exports.list = list;
exports.add = add;
exports.remove = remove;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../lib/config");
/**
 * Search for an account
 */
async function search(query, options) {
    const spinner = (0, ora_1.default)(`Searching for ${query}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const response = await axios_1.default.get(`${keys.relay}/v1/registry/search?q=${encodeURIComponent(query)}`, { timeout: 10000 });
        const results = response.data.results || [];
        if (results.length === 0) {
            spinner.fail('No accounts found');
            return;
        }
        spinner.succeed(`Found ${results.length} account(s):`);
        for (const result of results) {
            console.log(chalk_1.default.cyan(`\n  ${result.username}`));
            console.log(chalk_1.default.gray(`    Registered: ${result.createdAt}`));
        }
        console.log();
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
/**
 * List contacts (metadata only)
 */
async function list(options) {
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            console.log(chalk_1.default.yellow('Agent not found'));
            return;
        }
        const username = getUsername(keys);
        const response = await axios_1.default.get(`${keys.relay}/v1/contacts`, {
            headers: { 'X-Username': username },
            timeout: 10000
        });
        const contacts = response.data.contacts || [];
        console.log(chalk_1.default.bold(`\n🐱 Contacts for ${keys.name}:`));
        console.log(chalk_1.default.gray('(Metadata for your reference - not used for access control)\n'));
        if (contacts.length === 0) {
            console.log(chalk_1.default.gray('No contacts saved'));
            console.log(chalk_1.default.gray('Use: coneko contact-add <address> --name "Display Name"\n'));
        }
        else {
            for (const contact of contacts) {
                console.log(chalk_1.default.cyan(`  ${contact.username}`));
                if (contact.name) {
                    console.log(chalk_1.default.gray(`    Name: ${contact.name}`));
                }
                if (contact.notes) {
                    console.log(chalk_1.default.gray(`    Notes: ${contact.notes}`));
                }
            }
            console.log();
        }
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
}
/**
 * Add a contact (metadata only)
 */
async function add(address, options) {
    const spinner = (0, ora_1.default)(`Adding contact ${address}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const username = getUsername(keys);
        const contact = address.includes('@') ? address.split('@')[0] : address;
        await axios_1.default.post(`${keys.relay}/v1/contacts`, {
            contact,
            name: options.name,
            notes: options.notes
        }, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        spinner.succeed(`Contact added: ${address}`);
        if (options.name) {
            console.log(chalk_1.default.gray(`  Name: ${options.name}`));
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
 * Remove a contact
 */
async function remove(address, options) {
    const spinner = (0, ora_1.default)(`Removing contact ${address}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        spinner.succeed(`Contact removed: ${address}`);
        console.log(chalk_1.default.gray('(Note: This only removes metadata, not permissions)'));
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
function getUsername(keys) {
    return keys.name?.toLowerCase().replace(/\s+/g, '-') || '';
}
//# sourceMappingURL=contacts.js.map