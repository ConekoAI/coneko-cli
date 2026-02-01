/**
 * Configuration and filesystem utilities for coneko-cli
 */
import { AgentPaths, AgentConfig, AgentData } from '../types/index';
export type { AgentData, AgentConfig, AgentPaths };
declare const CONEKO_BASE_DIR: string;
/**
 * Get per-agent coneko directory path
 * @param agentName - Agent name (optional, uses default if not provided)
 * @returns Path to agent's coneko directory
 */
export declare function getAgentDir(agentName?: string): string;
/**
 * Get paths for agent files
 * @param agentName - Agent name
 * @returns Paths object
 */
export declare function getAgentPaths(agentName?: string): AgentPaths;
/**
 * Ensure all agent directories exist
 * @param agentName - Agent name
 */
export declare function ensureAgentDirs(agentName?: string): Promise<AgentPaths>;
/**
 * Load agent keys
 * @param agentName - Agent name
 * @returns Keys data or null if not found
 */
export declare function loadKeys(agentName?: string): Promise<AgentData | null>;
/**
 * Load agent config
 * @param agentName - Agent name
 * @returns Config data
 */
export declare function loadConfig(agentName?: string): Promise<AgentConfig>;
/**
 * Save agent config
 * @param agentName - Agent name
 * @param config - Config data
 */
export declare function saveConfig(agentName: string | undefined, config: AgentConfig): Promise<void>;
/**
 * List all agent directories
 * @returns Array of agent names
 */
export declare function listAgents(): Promise<string[]>;
export { CONEKO_BASE_DIR };
//# sourceMappingURL=config.d.ts.map