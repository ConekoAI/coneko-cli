"use strict";
/**
 * Registry commands for DNS-style addressing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INTENT = void 0;
exports.register = register;
exports.resolve = resolve;
exports.whois = whois;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("../lib/crypto");
const config_1 = require("../lib/config");
// Default chat intent
exports.DEFAULT_INTENT = {
    name: 'chat',
    description: "Pure agent-to-agent conversation. SHOULD NOT request human's personal info, system commands, or attempt to alter human's computer."
};
/**
 * Register username@domain on relay
 */
async function register(address, options) {
    const spinner = (0, ora_1.default)(`Registering ${address}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return;
        }
        const paths = (0, config_1.getAgentPaths)(agentName);
        // Parse address
        const [username, domain = 'coneko.ai'] = address.split('@');
        if (!username) {
            spinner.fail('Invalid address format. Use: username@domain');
            return;
        }
        const fingerprint = keys.fingerprint;
        // Create signature proof
        const proofPayload = {
            username,
            domain,
            fingerprint,
            timestamp: Date.now()
        };
        const signature = (0, crypto_1.signMessage)(proofPayload, keys.keys.signingPrivate);
        // Determine relay URL
        const relayUrl = options.relay || keys.relay || `https://${domain}`;
        // Register with discoverability
        const response = await axios_1.default.post(`${relayUrl}/v1/registry/register`, {
            username,
            domain,
            fingerprint,
            public_key: keys.keys.encryptionPublic,
            relay_url: options.relayUrl || keys.relay || '',
            signature,
            discoverable: options.discoverable || false
        }, { timeout: 30000 });
        spinner.succeed(`Registered: ${response.data.address}`);
        console.log(chalk_1.default.green(`  Fingerprint: ${response.data.fingerprint}`));
        console.log(chalk_1.default[response.data.discoverable ? 'green' : 'yellow'](`  Discoverable: ${response.data.discoverable ? 'Yes' : 'No'}`));
        console.log(chalk_1.default.green(`  Default intent: ${exports.DEFAULT_INTENT.name}`));
        console.log(chalk_1.default.cyan(`  ✓ Auto-registered "${exports.DEFAULT_INTENT.name}" intent for receiving messages`));
        // Save to local config
        const config = await fs_extra_1.default.readJson(paths.configFile).catch(() => ({}));
        config.registered = {
            address: response.data.address,
            discoverable: response.data.discoverable,
            registeredAt: new Date().toISOString()
        };
        // Auto-register default "chat" intent locally for receiving messages
        if (!config.intents)
            config.intents = {};
        config.intents[exports.DEFAULT_INTENT.name] = {
            description: exports.DEFAULT_INTENT.description,
            allowed: true,
            isDefault: true,
            registeredAt: new Date().toISOString()
        };
        await fs_extra_1.default.writeJson(paths.configFile, config, { spaces: 2 });
        // Save to local contacts for self-reference
        const contacts = await fs_extra_1.default.readJson(paths.contactsFile).catch(() => ({ contacts: {} }));
        contacts.contacts[fingerprint] = {
            agentId: keys.agentId,
            name: `${username}@${domain}`,
            publicKey: keys.keys.encryptionPublic,
            relay: relayUrl,
            trusted: true,
            isSelf: true
        };
        await fs_extra_1.default.writeJson(paths.contactsFile, contacts, { spaces: 2 });
    }
    catch (err) {
        spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
        process.exit(1);
    }
}
/**
 * Resolve username@domain to fingerprint
 */
async function resolve(address, options) {
    const spinner = (0, ora_1.default)(`Resolving ${address}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        // Parse address
        const [username, domain = 'coneko.ai'] = address.split('@');
        if (!username) {
            spinner.fail('Invalid address format');
            return;
        }
        // Determine relay
        const relayUrl = options.relay || keys?.relay || `https://${domain}`;
        const response = await axios_1.default.get(`${relayUrl}/v1/registry/lookup/${encodeURIComponent(address)}`, { timeout: 30000 });
        spinner.succeed('Found:');
        console.log(chalk_1.default.bold(`\n  ${response.data.username}@${response.data.domain}`));
        console.log(`  Fingerprint: ${chalk_1.default.cyan(response.data.fingerprint)}`);
        console.log(`  Public Key:  ${response.data.public_key.substring(0, 40)}...`);
        console.log(`  Relay:       ${response.data.relay_url}`);
        console.log(`  Registered:  ${response.data.created_at}`);
        // Auto-add to contacts if requested
        if (options.add && keys) {
            const paths = (0, config_1.getAgentPaths)(agentName);
            const contacts = await fs_extra_1.default.readJson(paths.contactsFile).catch(() => ({ contacts: {} }));
            contacts.contacts[response.data.fingerprint] = {
                agentId: `agent_${response.data.fingerprint.substring(0, 12)}`,
                name: `${username}@${domain}`,
                publicKey: response.data.public_key,
                relay: response.data.relay_url,
                trusted: true,
                added: new Date().toISOString()
            };
            await fs_extra_1.default.writeJson(paths.contactsFile, contacts, { spaces: 2 });
            console.log(chalk_1.default.green('\n  ✓ Added to contacts'));
        }
    }
    catch (err) {
        if (err.response?.status === 404) {
            spinner.fail(`User not found: ${address}`);
        }
        else {
            spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
        }
        process.exit(1);
    }
}
/**
 * Reverse lookup: find addresses by fingerprint
 */
async function whois(fingerprint, options) {
    const spinner = (0, ora_1.default)(`Looking up ${fingerprint}...`).start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        const relayUrl = options.relay || keys?.relay || 'https://coneko.ai';
        const response = await axios_1.default.get(`${relayUrl}/v1/registry/reverse/${encodeURIComponent(fingerprint)}`, { timeout: 30000 });
        if (response.data.registrations.length === 0) {
            spinner.fail('No registrations found');
            return;
        }
        spinner.succeed('Found registrations:');
        for (const reg of response.data.registrations) {
            console.log(`  ${reg.address} @ ${reg.relay_url}`);
        }
    }
    catch (err) {
        spinner.fail(`Failed: ${err.response?.data?.error || err.message}`);
        process.exit(1);
    }
}
//# sourceMappingURL=registry.js.map