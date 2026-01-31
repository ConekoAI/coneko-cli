const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const CONEKO_BASE_DIR = path.join(os.homedir(), '.coneko');

/**
 * Get per-agent coneko directory path
 * @param {string} agentName - Agent name (optional, uses default if not provided)
 * @returns {string} Path to agent's coneko directory
 */
function getAgentDir(agentName) {
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
 * @param {string} agentName - Agent name
 * @returns {Object} Paths object
 */
function getAgentPaths(agentName) {
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
 * @param {string} agentName - Agent name
 */
async function ensureAgentDirs(agentName) {
  const paths = getAgentPaths(agentName);
  await fs.ensureDir(paths.agentDir);
  await fs.ensureDir(paths.polledDir);
  await fs.ensureDir(paths.readDir);
  return paths;
}

/**
 * Load agent keys
 * @param {string} agentName - Agent name
 * @returns {Object|null} Keys data or null if not found
 */
async function loadKeys(agentName) {
  const paths = getAgentPaths(agentName);
  if (await fs.pathExists(paths.keysFile)) {
    return fs.readJson(paths.keysFile);
  }
  return null;
}

/**
 * Load agent config
 * @param {string} agentName - Agent name
 * @returns {Object} Config data
 */
async function loadConfig(agentName) {
  const paths = getAgentPaths(agentName);
  if (await fs.pathExists(paths.configFile)) {
    return fs.readJson(paths.configFile);
  }
  return { relay: 'https://api.coneko.ai' };
}

/**
 * Save agent config
 * @param {string} agentName - Agent name
 * @param {Object} config - Config data
 */
async function saveConfig(agentName, config) {
  const paths = getAgentPaths(agentName);
  await fs.ensureDir(paths.agentDir);
  await fs.writeJson(paths.configFile, config, { spaces: 2 });
}

/**
 * List all agent directories
 * @returns {string[]} Array of agent names
 */
async function listAgents() {
  if (!await fs.pathExists(CONEKO_BASE_DIR)) {
    return [];
  }
  const entries = await fs.readdir(CONEKO_BASE_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

module.exports = {
  CONEKO_BASE_DIR,
  getAgentDir,
  getAgentPaths,
  ensureAgentDirs,
  loadKeys,
  loadConfig,
  saveConfig,
  listAgents
};
