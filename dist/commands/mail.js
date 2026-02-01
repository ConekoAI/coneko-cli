"use strict";
/**
 * Mail polling commands
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = check;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../lib/config");
const crypto_1 = require("../lib/crypto");
/**
 * Poll for messages from relay and save to agent's polled folder
 */
async function check(options) {
    const spinner = (0, ora_1.default)('Checking for messages...').start();
    try {
        const agentName = options.agent;
        const paths = (0, config_1.getAgentPaths)(agentName);
        // Load identity
        const keys = await (0, config_1.loadKeys)(agentName);
        if (!keys) {
            spinner.fail(agentName ? `Agent "${agentName}" not found` : 'No agent initialized');
            console.log(chalk_1.default.yellow('Run: coneko init -n <name>'));
            return { count: 0 };
        }
        // Ensure directories exist
        await (0, config_1.ensureAgentDirs)(agentName || keys.name);
        spinner.text = `Fetching messages for ${keys.name}...`;
        // Fetch from relay
        const config = await (0, config_1.loadConfig)(agentName);
        let username = keys.name?.toLowerCase().replace(/\s+/g, '-');
        if (config.registered?.address) {
            username = config.registered.address.split('@')[0];
        }
        const response = await axios_1.default.get(`${keys.relay}/v1/messages`, {
            headers: { 'X-Username': username },
            params: { limit: options.limit || 10 },
            timeout: 30000
        });
        const messages = response.data.messages || [];
        if (messages.length === 0) {
            spinner.succeed('No new messages');
            config.lastPoll = new Date().toISOString();
            await fs_extra_1.default.writeJson(paths.configFile, config, { spaces: 2 });
            return { count: 0, agentName: keys.name, agentDir: paths.agentDir };
        }
        spinner.text = `Received ${messages.length} message(s), saving to polled folder...`;
        const savedFiles = [];
        for (const msg of messages) {
            const fileName = `msg-${msg.id}.json`;
            const filePath = path_1.default.join(paths.polledDir, fileName);
            const messageData = {
                ...msg,
                _receivedAt: new Date().toISOString(),
                _agentName: keys.name,
                _agentFingerprint: keys.fingerprint
            };
            // Optionally decrypt for easier human audit
            if (options.decrypt && msg.content) {
                try {
                    const payload = typeof msg.content === 'string'
                        ? JSON.parse(msg.content)
                        : msg.content;
                    const decrypted = (0, crypto_1.decryptMessage)(payload, keys.keys.encryptionPrivate);
                    const decryptedMessage = JSON.parse(decrypted);
                    messageData._decrypted = {
                        from: decryptedMessage.sender?.name || decryptedMessage.sender?.fingerprint || 'unknown',
                        fingerprint: decryptedMessage.sender?.fingerprint,
                        intents: decryptedMessage.intents,
                        content: decryptedMessage.content,
                        humanMessage: decryptedMessage.content?.humanMessage,
                        decryptedAt: new Date().toISOString()
                    };
                    messageData._encryptedPayload = msg.content;
                    delete messageData.content;
                }
                catch (decryptErr) {
                    messageData._decryptError = decryptErr.message;
                }
            }
            await fs_extra_1.default.writeJson(filePath, messageData, { spaces: 2 });
            savedFiles.push({ id: msg.id, path: filePath, decrypted: !!messageData._decrypted });
            // Acknowledge (delete from relay)
            if (options.ack !== false) {
                try {
                    await axios_1.default.delete(`${keys.relay}/v1/messages/${msg.id}`, { headers: { 'X-Username': username } });
                }
                catch {
                    spinner.warn(`Failed to ack message ${msg.id}`);
                }
            }
        }
        // Update lastPoll timestamp
        config.lastPoll = new Date().toISOString();
        await fs_extra_1.default.writeJson(paths.configFile, config, { spaces: 2 });
        const decryptedCount = savedFiles.filter(f => f.decrypted).length;
        spinner.succeed(`Saved ${savedFiles.length} message(s) to ${paths.polledDir}`);
        if (decryptedCount > 0) {
            console.log(chalk_1.default.green(`   ✓ ${decryptedCount} message(s) decrypted for easy reading`));
        }
        console.log(chalk_1.default.cyan('\n📬 New messages received'));
        console.log(chalk_1.default.gray(`   Agent: ${keys.name}`));
        console.log(chalk_1.default.gray(`   Location: ${paths.polledDir}`));
        if (!options.decrypt) {
            console.log(chalk_1.default.gray(`   Format: Encrypted (use --decrypt for plaintext)`));
        }
        else {
            console.log(chalk_1.default.gray(`   Format: Decrypted (human-readable)`));
        }
        console.log(chalk_1.default.yellow('\nNext steps:'));
        console.log(chalk_1.default.gray('   1. Read messages directly from the polled folder'));
        console.log(chalk_1.default.gray('   2. Process as needed, then archive to read/ folder\n'));
        return {
            count: savedFiles.length,
            agentName: keys.name,
            agentDir: paths.agentDir
        };
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        if (err.response) {
            console.error(chalk_1.default.red(`   Server error: ${err.response.status} ${err.response.statusText}`));
        }
        throw err;
    }
}
//# sourceMappingURL=mail.js.map