"use strict";
/**
 * Permission management commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPermission = grantPermission;
exports.revokePermission = revokePermission;
exports.listGrantedPermissions = listGrantedPermissions;
exports.listReceivedPermissions = listReceivedPermissions;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../lib/config");
/**
 * Grant permission to a sender for a privileged intent
 */
async function grantPermission(grantee, options) {
    const spinner = (0, ora_1.default)(`Granting permission to ${grantee}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const intent = options.intent;
        if (!intent) {
            spinner.fail('--intent is required');
            return;
        }
        const username = getUsername(keys);
        await axios_1.default.post(`${keys.relay}/v1/permissions/grant`, { grantee, intent }, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        spinner.succeed(`Granted permission: ${grantee} can use '${intent}' intent`);
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
 * Revoke permission from a sender
 */
async function revokePermission(grantee, options) {
    const spinner = (0, ora_1.default)(`Revoking permission from ${grantee}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const intent = options.intent;
        if (!intent) {
            spinner.fail('--intent is required');
            return;
        }
        const username = getUsername(keys);
        await axios_1.default.post(`${keys.relay}/v1/permissions/revoke`, { grantee, intent }, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        spinner.succeed(`Revoked permission: ${grantee} can no longer use '${intent}'`);
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
 * List permissions I've granted
 */
async function listGrantedPermissions(options) {
    const spinner = (0, ora_1.default)('Fetching permissions...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const username = getUsername(keys);
        const response = await axios_1.default.get(`${keys.relay}/v1/permissions/granted`, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        const permissions = response.data.permissions || {};
        const entries = Object.entries(permissions);
        spinner.stop();
        console.log(chalk_1.default.bold(`\n🐱 Permissions Granted by ${keys.name}:`));
        if (entries.length === 0) {
            console.log(chalk_1.default.gray('No permissions granted yet'));
            console.log(chalk_1.default.gray('Use: coneko permit <user> --intent <name>\n'));
            return;
        }
        for (const [grantee, intents] of entries) {
            console.log(chalk_1.default.cyan(`\n${grantee}:`));
            for (const intent of intents) {
                console.log(`  • ${chalk_1.default.green(intent)}`);
            }
        }
        console.log();
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
/**
 * List permissions I've received (what I can send)
 */
async function listReceivedPermissions(options) {
    const spinner = (0, ora_1.default)('Fetching permissions...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const username = getUsername(keys);
        const response = await axios_1.default.get(`${keys.relay}/v1/permissions/received`, {
            headers: { 'X-Username': username },
            timeout: 30000
        });
        const permissions = response.data.permissions || {};
        const entries = Object.entries(permissions);
        spinner.stop();
        console.log(chalk_1.default.bold(`\n🐱 Permissions Received by ${keys.name}:`));
        console.log(chalk_1.default.gray('(Privileged intents you can use when messaging others)\n'));
        if (entries.length === 0) {
            console.log(chalk_1.default.gray('No permissions received yet'));
            console.log(chalk_1.default.gray('Ask others to grant you permission for their privileged intents\n'));
            return;
        }
        for (const [owner, intents] of entries) {
            console.log(chalk_1.default.cyan(`${owner}:`));
            for (const intent of intents) {
                console.log(`  • ${chalk_1.default.green(intent)}`);
            }
        }
        console.log();
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
function getUsername(keys) {
    return keys.name?.toLowerCase().replace(/\s+/g, '-') || '';
}
//# sourceMappingURL=permissions.js.map