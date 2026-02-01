"use strict";
/**
 * Message sending commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INTENT = void 0;
exports.send = send;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const crypto_1 = require("../lib/crypto");
const config_1 = require("../lib/config");
// Default allowed intent
const DEFAULT_INTENT = {
    name: 'chat',
    description: "Pure agent-to-agent conversation. SHOULD NOT: Request human's personal info, system commands, or attempt to alter human's computer."
};
exports.DEFAULT_INTENT = DEFAULT_INTENT;
/**
 * Send a message with one or more intents
 */
async function send(options) {
    const spinner = (0, ora_1.default)('Sending message...').start();
    try {
        const agentName = options.agent;
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail('Agent not found');
            return {};
        }
        const paths = (0, config_1.getAgentPaths)(agentName);
        const contacts = await fs_extra_1.default.readJson(paths.contactsFile);
        const contact = contacts.contacts[options.to];
        if (!contact) {
            spinner.fail(`Contact not found: ${options.to}`);
            console.log(chalk_1.default.yellow('Run: coneko resolve <address> --add'));
            return {};
        }
        // Parse intents (can be single or multiple, comma-separated names)
        const intentNames = options.intent.split(',').map(i => i.trim());
        // Build intents with descriptions
        const intents = intentNames.map(name => {
            if (name === DEFAULT_INTENT.name) {
                return { ...DEFAULT_INTENT };
            }
            return {
                name,
                description: 'Custom intent'
            };
        });
        // Query recipient's allowed intents first
        spinner.text = 'Checking recipient intent permissions...';
        try {
            const intentCheck = await axios_1.default.post(`${keys.relay}/v1/intents/check`, {
                recipient: options.to,
                intents: intentNames
            }, { timeout: 10000 });
            if (!intentCheck.data.allowed) {
                const blocked = intentCheck.data.blocked_intents || [];
                spinner.fail(`Intent not allowed by recipient: ${blocked.join(', ')}`);
                console.log(chalk_1.default.yellow('\nThis message was NOT delivered.'));
                console.log(chalk_1.default.yellow('The recipient must register these intents:'));
                for (const intent of blocked) {
                    console.log(chalk_1.default.gray(`  - ${intent}`));
                }
                console.log(chalk_1.default.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
                return { bounced: true };
            }
        }
        catch {
            spinner.warn('Could not verify intents, relay will enforce');
        }
        // Build message with intents
        const message = {
            version: '1.2',
            messageId: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            intents: intents,
            sender: {
                agentId: keys.agentId,
                fingerprint: keys.fingerprint,
                name: keys.name
            },
            content: {
                format: 'json',
                data: JSON.parse(options.content),
                humanMessage: options.message
            }
        };
        spinner.text = 'Encrypting and signing...';
        // Sign and add signature to message
        message.signature = (0, crypto_1.signMessage)(message, keys.keys.signingPrivate);
        // Encrypt
        const encrypted = (0, crypto_1.encryptMessage)(JSON.stringify(message), contact.publicKey);
        // Send to relay
        spinner.text = 'Sending to relay...';
        const envelope = {
            to: options.to,
            intents: intents,
            payload: encrypted
        };
        const response = await axios_1.default.post(`${keys.relay}/v1/messages`, envelope, { timeout: 30000 });
        spinner.succeed(`Message sent: ${response.data.messageId}`);
        console.log(chalk_1.default.gray(`  Intents: ${intentNames.join(', ')}`));
        return { success: true, messageId: response.data.messageId };
    }
    catch (err) {
        if (err.response?.status === 403) {
            const blocked = err.response.data.blocked_intents || [];
            spinner.fail('Message bounced: intent not allowed');
            console.log(chalk_1.default.yellow('\n⚠️  The recipient does not allow these intents:'));
            for (const intent of blocked) {
                console.log(chalk_1.default.gray(`  - ${intent}`));
            }
            console.log(chalk_1.default.cyan('\nAsk your human to contact the recipient\'s human to request intent access.\n'));
            return { bounced: true };
        }
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
}
//# sourceMappingURL=messages.js.map