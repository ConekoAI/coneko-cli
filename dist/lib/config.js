"use strict";
/**
 * Configuration and filesystem utilities for coneko-cli
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONEKO_BASE_DIR = void 0;
exports.getAgentDir = getAgentDir;
exports.getAgentPaths = getAgentPaths;
exports.ensureAgentDirs = ensureAgentDirs;
exports.loadKeys = loadKeys;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.listAgents = listAgents;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const CONEKO_BASE_DIR = path_1.default.join(os_1.default.homedir(), '.coneko');
exports.CONEKO_BASE_DIR = CONEKO_BASE_DIR;
/**
 * Get per-agent coneko directory path
 * @param agentName - Agent name (optional, uses default if not provided)
 * @returns Path to agent's coneko directory
 */
function getAgentDir(agentName) {
    if (!agentName) {
        // Try to get from environment or use 'default'
        agentName = process.env.CONEKO_AGENT || 'default';
    }
    // Sanitize agent name for filesystem
    const safeName = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return path_1.default.join(CONEKO_BASE_DIR, safeName);
}
/**
 * Get paths for agent files
 * @param agentName - Agent name
 * @returns Paths object
 */
function getAgentPaths(agentName) {
    const agentDir = getAgentDir(agentName);
    return {
        baseDir: CONEKO_BASE_DIR,
        agentDir,
        keysFile: path_1.default.join(agentDir, 'keys.json'),
        configFile: path_1.default.join(agentDir, 'config.json'),
        contactsFile: path_1.default.join(agentDir, 'contacts.json'),
        permissionsFile: path_1.default.join(agentDir, 'permissions.json'),
        polledDir: path_1.default.join(agentDir, 'polled'),
        readDir: path_1.default.join(agentDir, 'read'),
        stateFile: path_1.default.join(agentDir, 'state.json')
    };
}
/**
 * Ensure all agent directories exist
 * @param agentName - Agent name
 */
async function ensureAgentDirs(agentName) {
    const paths = getAgentPaths(agentName);
    await fs_extra_1.default.ensureDir(paths.agentDir);
    await fs_extra_1.default.ensureDir(paths.polledDir);
    await fs_extra_1.default.ensureDir(paths.readDir);
    return paths;
}
/**
 * Load agent keys
 * @param agentName - Agent name
 * @returns Keys data or null if not found
 */
async function loadKeys(agentName) {
    const paths = getAgentPaths(agentName);
    if (await fs_extra_1.default.pathExists(paths.keysFile)) {
        return fs_extra_1.default.readJson(paths.keysFile);
    }
    return null;
}
/**
 * Load agent config
 * @param agentName - Agent name
 * @returns Config data
 */
async function loadConfig(agentName) {
    const paths = getAgentPaths(agentName);
    if (await fs_extra_1.default.pathExists(paths.configFile)) {
        return fs_extra_1.default.readJson(paths.configFile);
    }
    return { relay: 'https://api.coneko.ai', lastPoll: null, discoverable: false };
}
/**
 * Save agent config
 * @param agentName - Agent name
 * @param config - Config data
 */
async function saveConfig(agentName, config) {
    const paths = getAgentPaths(agentName);
    await fs_extra_1.default.ensureDir(paths.agentDir);
    await fs_extra_1.default.writeJson(paths.configFile, config, { spaces: 2 });
}
/**
 * List all agent directories
 * @returns Array of agent names
 */
async function listAgents() {
    if (!await fs_extra_1.default.pathExists(CONEKO_BASE_DIR)) {
        return [];
    }
    const entries = await fs_extra_1.default.readdir(CONEKO_BASE_DIR, { withFileTypes: true });
    return entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
}
//# sourceMappingURL=config.js.map