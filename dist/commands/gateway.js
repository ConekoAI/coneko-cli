"use strict";
/**
 * Gateway setup command
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setup = setup;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const config_1 = require("../lib/config");
const OPENCLAW_DIR = path_1.default.join(os_1.default.homedir(), '.openclaw');
const OPENCLAW_CONFIG = path_1.default.join(OPENCLAW_DIR, 'openclaw.json');
/**
 * Setup coneko-gateway agent in OpenClaw configuration
 */
async function setup(options) {
    const spinner = (0, ora_1.default)('Setting up coneko-gateway agent...').start();
    try {
        // Check if openclaw is installed
        if (!await fs_extra_1.default.pathExists(OPENCLAW_CONFIG)) {
            spinner.fail('OpenClaw not found. Please install OpenClaw first.');
            console.log(chalk_1.default.yellow('\nInstall: https://docs.openclaw.ai/install'));
            return;
        }
        // Get agent info if specified
        const agentName = options.agent;
        const agentPaths = agentName ? (0, config_1.getAgentPaths)(agentName) : null;
        const keys = agentName ? await (0, config_1.loadKeys)(agentName) : null;
        // Read current config
        const config = await fs_extra_1.default.readJson(OPENCLAW_CONFIG);
        // Backup existing config
        const backupPath = `${OPENCLAW_CONFIG}.backup.${Date.now()}`;
        await fs_extra_1.default.copy(OPENCLAW_CONFIG, backupPath);
        spinner.info(`Config backed up to: ${backupPath}`);
        // Ensure agents.list exists
        if (!config.agents)
            config.agents = { list: [] };
        if (!config.agents.list)
            config.agents.list = [];
        // Define coneko-gateway agent with restricted tool access
        const gatewayWorkspace = path_1.default.join(os_1.default.homedir(), 'coneko-gateway');
        const gatewayAgent = {
            id: 'coneko-gateway',
            name: 'Coneko Gateway',
            description: 'Security-isolated agent for auditing coneko messages',
            workspace: gatewayWorkspace,
            tools: {
                allow: ['read', 'write'],
                deny: [
                    'exec', 'process',
                    'browser', 'canvas',
                    'cron',
                    'gateway',
                    'nodes',
                    'message',
                    'sessions_spawn',
                    'web_search', 'web_fetch',
                    'group:runtime',
                    'group:automation',
                    'group:messaging'
                ]
            }
        };
        // Check if coneko-gateway already exists
        const existingIndex = config.agents.list.findIndex(a => a.id === 'coneko-gateway');
        if (existingIndex >= 0) {
            config.agents.list[existingIndex] = gatewayAgent;
            spinner.info('Updated existing coneko-gateway agent configuration');
        }
        else {
            config.agents.list.push(gatewayAgent);
            spinner.info('Added coneko-gateway agent to configuration');
        }
        // Write updated config
        await fs_extra_1.default.writeJson(OPENCLAW_CONFIG, config, { spaces: 2 });
        // Create workspace
        await fs_extra_1.default.ensureDir(gatewayWorkspace);
        // Create IDENTITY.md
        const identityContent = `# IDENTITY.md - Coneko Gateway Agent

## Who You Are

You are the **coneko-gateway** security auditor subagent...
[Content truncated for brevity - full content preserved in source]
`;
        await fs_extra_1.default.writeFile(path_1.default.join(gatewayWorkspace, 'IDENTITY.md'), identityContent);
        // Create AGENTS.md
        const agentsContent = `# AGENTS.md - Coneko Gateway

## Security Profile

This is a **restricted agent** with minimal tool access...
`;
        await fs_extra_1.default.writeFile(path_1.default.join(gatewayWorkspace, 'AGENTS.md'), agentsContent);
        // Create USER.md
        const userContent = `# USER.md - Coneko Gateway

## Parent Agent

This subagent serves the main OpenClaw agent for coneko message auditing...
`;
        await fs_extra_1.default.writeFile(path_1.default.join(gatewayWorkspace, 'USER.md'), userContent);
        // Create inbox reference
        const inboxContent = `# Coneko Agent Inboxes

Per-agent coneko directories:

${agentName && keys ? `- ${keys.name}: ${agentPaths?.agentDir}` : '- Run "coneko whoami" to see your agent'}

To audit messages, spawn this subagent with the specific agent's polled/ path.
`;
        await fs_extra_1.default.writeFile(path_1.default.join(gatewayWorkspace, 'CONEKO_INBOXES.md'), inboxContent);
        spinner.succeed('Coneko Gateway setup complete!');
        console.log(chalk_1.default.green(`\n📁 Workspace: ${gatewayWorkspace}`));
        console.log(chalk_1.default.cyan('\nAgent Configuration:'));
        console.log(chalk_1.default.gray('   ID: coneko-gateway'));
        console.log(chalk_1.default.gray('   Tools: read, write only'));
        console.log(chalk_1.default.gray('   Isolated: Yes'));
        if (keys) {
            console.log(chalk_1.default.cyan(`\nLinked Coneko Agent: ${keys.name}`));
            console.log(chalk_1.default.gray(`   Location: ${agentPaths?.agentDir}`));
        }
        console.log(chalk_1.default.yellow('\n⚠️  Restart OpenClaw to apply changes'));
        console.log(chalk_1.default.gray('   Then use: coneko poll --agent <name>'));
        console.log(chalk_1.default.gray('   And spawn subagent with audit task\n'));
    }
    catch (err) {
        spinner.fail(`Setup failed: ${err.message}`);
        console.error(chalk_1.default.red(err.stack));
        process.exit(1);
    }
}
//# sourceMappingURL=gateway.js.map