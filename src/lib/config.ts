/**
 * Configuration and filesystem utilities for coneko-cli
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AgentPaths, AgentConfig, AgentData } from '../types/index';

export type { AgentData, AgentConfig, AgentPaths };

const CONEKO_BASE_DIR = path.join(os.homedir(), '.coneko');

/**
 * Get per-agent coneko directory path
 * @param agentName - Agent name (optional, uses default if not provided)
 * @returns Path to agent's coneko directory
 */
export function getAgentDir(agentName?: string): string {
  if (!agentName) {
    // Try to get from environment or use 'default'
    agentName = process.env.CONEKO_AGENT || 'default';
  }
  // Sanitize agent name for filesystem
  const safeName = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return path.join(CONEKO_BASE_DIR, safeName);
}

/**
 * Get paths for agent files
 * @param agentName - Agent name
 * @returns Paths object
 */
export function getAgentPaths(agentName?: string): AgentPaths {
  const agentDir = getAgentDir(agentName);
  return {
    baseDir: CONEKO_BASE_DIR,
    agentDir,
    keysFile: path.join(agentDir, 'keys.json'),
    configFile: path.join(agentDir, 'config.json'),
    contactsFile: path.join(agentDir, 'contacts.json'),
    permissionsFile: path.join(agentDir, 'permissions.json'),
    polledDir: path.join(agentDir, 'polled'),
    readDir: path.join(agentDir, 'read'),
    stateFile: path.join(agentDir, 'state.json')
  };
}

/**
 * Ensure all agent directories exist
 * @param agentName - Agent name
 */
export async function ensureAgentDirs(agentName?: string): Promise<AgentPaths> {
  const paths = getAgentPaths(agentName);
  await fs.ensureDir(paths.agentDir);
  await fs.ensureDir(paths.polledDir);
  await fs.ensureDir(paths.readDir);
  return paths;
}

/**
 * Load agent keys
 * @param agentName - Agent name
 * @returns Keys data or null if not found
 */
export async function loadKeys(agentName?: string): Promise<AgentData | null> {
  const paths = getAgentPaths(agentName);
  if (await fs.pathExists(paths.keysFile)) {
    return fs.readJson(paths.keysFile);
  }
  return null;
}

/**
 * Load agent config
 * @param agentName - Agent name
 * @returns Config data
 */
export async function loadConfig(agentName?: string): Promise<AgentConfig> {
  const paths = getAgentPaths(agentName);
  if (await fs.pathExists(paths.configFile)) {
    return fs.readJson(paths.configFile);
  }
  return { relay: 'https://api.coneko.ai', lastPoll: null, discoverable: false };
}

/**
 * Save agent config
 * @param agentName - Agent name
 * @param config - Config data
 */
export async function saveConfig(agentName: string | undefined, config: AgentConfig): Promise<void> {
  const paths = getAgentPaths(agentName);
  await fs.ensureDir(paths.agentDir);
  await fs.writeJson(paths.configFile, config, { spaces: 2 });
}

/**
 * List all agent directories
 * @returns Array of agent names
 */
export async function listAgents(): Promise<string[]> {
  if (!await fs.pathExists(CONEKO_BASE_DIR)) {
    return [];
  }
  const entries = await fs.readdir(CONEKO_BASE_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

export { CONEKO_BASE_DIR };
