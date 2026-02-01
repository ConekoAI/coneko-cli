"use strict";
/**
 * Identity management commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.whoami = whoami;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const crypto_1 = require("../lib/crypto");
const config_1 = require("../lib/config");
/**
 * Initialize a new agent identity
 */
async function init(options) {
    const spinner = (0, ora_1.default)('Initializing agent...').start();
    try {
        const agentName = options.name.toLowerCase().replace(/\s+/g, '-');
        const paths = await (0, config_1.ensureAgentDirs)(agentName);
        // Check if already initialized
        if (await fs_extra_1.default.pathExists(paths.keysFile)) {
            spinner.info('Agent already initialized');
            const existing = await (0, config_1.loadKeys)(agentName);
            if (existing) {
                console.log(chalk_1.default.yellow(`\nExisting agent: ${existing.name}`));
                console.log(chalk_1.default.yellow(`Fingerprint: ${existing.fingerprint}`));
                console.log(chalk_1.default.gray(`Location: ${paths.agentDir}`));
            }
            return;
        }
        const keyPair = (0, crypto_1.generateKeyPair)();
        const fingerprint = (0, crypto_1.getFingerprint)(keyPair.encryptionPublic);
        const agentId = `agent_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
        const keyData = {
            agentId,
            name: options.name,
            relay: options.relay,
            keys: keyPair,
            fingerprint,
            created: new Date().toISOString()
        };
        await fs_extra_1.default.writeJson(paths.keysFile, keyData, { spaces: 2 });
        await fs_extra_1.default.writeJson(paths.contactsFile, { contacts: {} }, { spaces: 2 });
        await fs_extra_1.default.writeJson(paths.permissionsFile, { contacts: {} }, { spaces: 2 });
        await fs_extra_1.default.writeJson(paths.configFile, {
            relay: options.relay,
            lastPoll: null,
            discoverable: false
        }, { spaces: 2 });
        spinner.succeed(`Agent "${options.name}" initialized`);
        console.log(chalk_1.default.green(`
Agent ID: ${agentId}`));
        console.log(chalk_1.default.green(`Fingerprint: ${fingerprint}`));
        console.log(chalk_1.default.green(`Relay: ${options.relay}`));
        console.log(chalk_1.default.cyan(`\nWorkspace: ${paths.agentDir}`));
        console.log(chalk_1.default.gray(`  keys.json       - Identity (keep secure!)`));
        console.log(chalk_1.default.gray(`  config.json     - Settings`));
        console.log(chalk_1.default.gray(`  polled/         - Incoming messages`));
        console.log(chalk_1.default.gray(`  read/           - Processed archive`));
        console.log(chalk_1.default.red(`\n⚠️  Keep keys.json secure — it contains your private keys!`));
    }
    catch (err) {
        spinner.fail(`Failed to initialize: ${err.message}`);
        process.exit(1);
    }
}
/**
 * Show current agent identity
 */
async function whoami(options) {
    try {
        const agentName = options.agent;
        const paths = (0, config_1.getAgentPaths)(agentName);
        if (!await fs_extra_1.default.pathExists(paths.keysFile)) {
            if (agentName) {
                console.log(chalk_1.default.yellow(`No agent "${agentName}" found.`));
            }
            else {
                console.log(chalk_1.default.yellow('No default agent initialized.'));
            }
            console.log(chalk_1.default.yellow('Run: coneko init -n <name>'));
            return;
        }
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            console.log(chalk_1.default.yellow('Could not load agent keys'));
            return;
        }
        console.log(chalk_1.default.bold('\n🐱 Agent Identity'));
        console.log(`  Name: ${chalk_1.default.cyan(keys.name)}`);
        console.log(`  ID: ${keys.agentId}`);
        console.log(`  Fingerprint: ${chalk_1.default.cyan(keys.fingerprint)}`);
        console.log(`  Relay: ${keys.relay}`);
        console.log(`  Created: ${keys.created}`);
        console.log(chalk_1.default.gray(`\nLocation: ${paths.agentDir}`));
        // Show other agents if any
        const allAgents = await (0, config_1.listAgents)();
        if (allAgents.length > 1) {
            const currentName = agentName || keys.name.toLowerCase().replace(/\s+/g, '-');
            const otherAgents = allAgents.filter(a => a !== currentName);
            if (otherAgents.length > 0) {
                console.log(chalk_1.default.gray(`\nOther agents: ${otherAgents.join(', ')}`));
            }
        }
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error: ${err.message}`));
        process.exit(1);
    }
}
//# sourceMappingURL=identity.js.map