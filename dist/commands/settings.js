"use strict";
/**
 * Settings and discoverability commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDiscoverable = setDiscoverable;
exports.getDiscoverable = getDiscoverable;
exports.searchAccounts = searchAccounts;
exports.getMetrics = getMetrics;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../lib/config");
/**
 * Set account discoverability
 */
async function setDiscoverable(discoverable, options) {
    const spinner = (0, ora_1.default)(`Setting discoverability to ${discoverable}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        await axios_1.default.post(`${keys.relay}/v1/registry/discoverable`, { discoverable }, {
            headers: { 'Authorization': `Bearer ${keys.fingerprint}` },
            timeout: 30000
        });
        spinner.succeed(`Account is now ${discoverable ? 'discoverable' : 'not discoverable'}`);
        // Update local config
        const paths = (0, config_1.getAgentPaths)(agentName);
        const config = await fs_extra_1.default.readJson(paths.configFile).catch(() => ({}));
        config.discoverable = discoverable;
        await fs_extra_1.default.writeJson(paths.configFile, config, { spaces: 2 });
        console.log(chalk_1.default.gray(`  Relay: ${keys.relay}`));
        console.log(chalk_1.default[discoverable ? 'green' : 'yellow'](discoverable
            ? '  Your account can now be found via search'
            : '  Your account will not appear in search results'));
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        if (err.response?.data?.error) {
            console.error(chalk_1.default.red(`  ${err.response.data.error}`));
        }
        process.exit(1);
    }
}
/**
 * Get current discoverability status
 */
async function getDiscoverable(options) {
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            console.log(chalk_1.default.yellow('Agent not found'));
            return;
        }
        const paths = (0, config_1.getAgentPaths)(agentName);
        const config = await fs_extra_1.default.readJson(paths.configFile).catch(() => ({}));
        console.log(chalk_1.default.bold('\n🐱 Account Discoverability'));
        console.log(`  Agent: ${keys.name}`);
        console.log(`  Fingerprint: ${keys.fingerprint}`);
        console.log(`  Discoverable: ${config.discoverable ? chalk_1.default.green('Yes') : chalk_1.default.yellow('No')}`);
        if (config.discoverable) {
            console.log(chalk_1.default.green('\n  ✓ Your account can be found via search'));
            console.log(chalk_1.default.gray('    Use "coneko search <query>" to test'));
        }
        else {
            console.log(chalk_1.default.yellow('\n  ✗ Your account is hidden from search'));
            console.log(chalk_1.default.gray('    Only those who know your address can find you'));
        }
        console.log(chalk_1.default.cyan('\n  To change:'));
        console.log(chalk_1.default.gray(`    coneko discoverable --agent ${keys.name}`));
        console.log(chalk_1.default.gray(`    coneko undiscoverable --agent ${keys.name}`));
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
}
/**
 * Search discoverable accounts
 */
async function searchAccounts(query, options) {
    const spinner = (0, ora_1.default)(`Searching for "${query}"...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const response = await axios_1.default.get(`${keys.relay}/v1/registry/search`, {
            params: { q: query, limit: options.limit || 20 },
            timeout: 10000
        });
        const results = response.data.results || [];
        if (results.length === 0) {
            spinner.info('No discoverable accounts found');
            console.log(chalk_1.default.gray('\n  Try:'));
            console.log(chalk_1.default.gray('    - Searching for a different term'));
            console.log(chalk_1.default.gray('    - Asking the person for their exact address'));
            return;
        }
        spinner.succeed(`Found ${results.length} account(s)`);
        console.log(chalk_1.default.bold('\n🐱 Discoverable Accounts:\n'));
        for (const account of results) {
            console.log(`  ${chalk_1.default.cyan(account.address)}`);
            console.log(`    Fingerprint: ${chalk_1.default.gray(account.fingerprint)}`);
            console.log(`    Relay: ${chalk_1.default.gray(account.relay)}`);
            console.log(`    Member since: ${chalk_1.default.gray(new Date(account.createdAt).toLocaleDateString())}`);
            console.log();
        }
        console.log(chalk_1.default.gray('  To add: coneko friend-request <address>'));
    }
    catch (err) {
        spinner.fail(`Search failed: ${err.message}`);
        if (err.response?.status === 400) {
            console.error(chalk_1.default.yellow('  Query must be at least 2 characters'));
        }
        process.exit(1);
    }
}
/**
 * Get service metrics
 */
async function getMetrics(options) {
    const spinner = (0, ora_1.default)('Fetching service metrics...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        const relay = keys ? keys.relay : (options.relay || 'https://api.coneko.ai');
        const response = await axios_1.default.get(`${relay}/v1/metrics`, { timeout: 10000 });
        const metrics = response.data;
        spinner.succeed('Service Metrics');
        console.log(chalk_1.default.bold('\n📊 Coneko Relay Statistics\n'));
        console.log(`  Total Accounts: ${chalk_1.default.cyan(metrics.accounts.toLocaleString())}`);
        console.log(`  Messages Sent:  ${chalk_1.default.cyan(metrics.messagesSent.toLocaleString())}`);
        console.log(`  Contacts Made:  ${chalk_1.default.cyan(metrics.contactsConnected.toLocaleString())}`);
        console.log(`  Last Updated:   ${chalk_1.default.gray(new Date(metrics.timestamp).toLocaleString())}`);
        console.log();
        console.log(chalk_1.default.gray(`  Relay: ${relay}`));
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
//# sourceMappingURL=settings.js.map