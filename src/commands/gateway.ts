/**
 * Gateway setup command
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { getAgentPaths, loadKeys } from '../lib/config';
import { CommandOptions } from '../types';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');

interface OpenClawConfig {
  agents?: {
    list?: Array<{
      id: string;
      name: string;
      description: string;
      workspace: string;
      tools: {
        allow: string[];
        deny: string[];
      };
    }>;
  };
}

/**
 * Setup coneko-gateway agent in OpenClaw configuration
 */
export async function setup(options: CommandOptions): Promise<void> {
  const spinner = ora('Setting up coneko-gateway agent...').start();
  
  try {
    // Check if openclaw is installed
    if (!await fs.pathExists(OPENCLAW_CONFIG)) {
      spinner.fail('OpenClaw not found. Please install OpenClaw first.');
      console.log(chalk.yellow('\nInstall: https://docs.openclaw.ai/install'));
      return;
    }
    
    // Get agent info if specified
    const agentName = options.agent;
    const agentPaths = agentName ? getAgentPaths(agentName) : null;
    const keys = agentName ? await loadKeys(agentName) : null;
    
    // Read current config
    const config = await fs.readJson(OPENCLAW_CONFIG) as OpenClawConfig;
    
    // Backup existing config
    const backupPath = `${OPENCLAW_CONFIG}.backup.${Date.now()}`;
    await fs.copy(OPENCLAW_CONFIG, backupPath);
    spinner.info(`Config backed up to: ${backupPath}`);
    
    // Ensure agents.list exists
    if (!config.agents) config.agents = { list: [] };
    if (!config.agents.list) config.agents.list = [];
    
    // Define coneko-gateway agent with restricted tool access
    const gatewayWorkspace = path.join(os.homedir(), 'coneko-gateway');
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
    } else {
      config.agents.list.push(gatewayAgent);
      spinner.info('Added coneko-gateway agent to configuration');
    }
    
    // Write updated config
    await fs.writeJson(OPENCLAW_CONFIG, config, { spaces: 2 });
    
    // Create workspace
    await fs.ensureDir(gatewayWorkspace);
    
    // Create IDENTITY.md
    const identityContent = `# IDENTITY.md - Coneko Gateway Agent

## Who You Are

You are the **coneko-gateway** security auditor subagent...
[Content truncated for brevity - full content preserved in source]
`;
    
    await fs.writeFile(path.join(gatewayWorkspace, 'IDENTITY.md'), identityContent);
    
    // Create AGENTS.md
    const agentsContent = `# AGENTS.md - Coneko Gateway

## Security Profile

This is a **restricted agent** with minimal tool access...
`;
    
    await fs.writeFile(path.join(gatewayWorkspace, 'AGENTS.md'), agentsContent);
    
    // Create USER.md
    const userContent = `# USER.md - Coneko Gateway

## Parent Agent

This subagent serves the main OpenClaw agent for coneko message auditing...
`;
    
    await fs.writeFile(path.join(gatewayWorkspace, 'USER.md'), userContent);
    
    // Create inbox reference
    const inboxContent = `# Coneko Agent Inboxes

Per-agent coneko directories:

${agentName && keys ? `- ${keys.name}: ${agentPaths?.agentDir}` : '- Run "coneko whoami" to see your agent'}

To audit messages, spawn this subagent with the specific agent's polled/ path.
`;
    await fs.writeFile(path.join(gatewayWorkspace, 'CONEKO_INBOXES.md'), inboxContent);
    
    spinner.succeed('Coneko Gateway setup complete!');
    
    console.log(chalk.green(`\n📁 Workspace: ${gatewayWorkspace}`));
    console.log(chalk.cyan('\nAgent Configuration:'));
    console.log(chalk.gray('   ID: coneko-gateway'));
    console.log(chalk.gray('   Tools: read, write only'));
    console.log(chalk.gray('   Isolated: Yes'));
    
    if (keys) {
      console.log(chalk.cyan(`\nLinked Coneko Agent: ${keys.name}`));
      console.log(chalk.gray(`   Location: ${agentPaths?.agentDir}`));
    }
    
    console.log(chalk.yellow('\n⚠️  Restart OpenClaw to apply changes'));
    console.log(chalk.gray('   Then use: coneko poll --agent <name>'));
    console.log(chalk.gray('   And spawn subagent with audit task\n'));
    
  } catch (err: any) {
    spinner.fail(`Setup failed: ${err.message}`);
    console.error(chalk.red(err.stack));
    process.exit(1);
  }
}
