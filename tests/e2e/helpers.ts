import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const API_URL = process.env.CONEKO_API_URL || 'http://localhost:3000';
const CLI_PATH = join(__dirname, '../../dist/cli.js');

/**
 * Helper to run CLI commands
 */
export function runCLI(args: string, env: Record<string, string> = {}): string {
  const testEnv = {
    ...process.env,
    ...env,
    CONEKO_API_URL: API_URL,
  };
  
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      env: testEnv,
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    // Return stderr output if command fails (CLI often writes errors to stderr)
    if (error.stderr) {
      return error.stderr;
    }
    if (error.stdout) {
      return error.stdout;
    }
    throw error;
  }
}

/**
 * Helper to get test config directory
 */
export function getTestConfigDir(testName: string): string {
  return join(__dirname, '.test-configs', testName);
}

/**
 * Helper to clean up test config
 */
export function cleanupTestConfig(testName: string): void {
  const configDir = getTestConfigDir(testName);
  if (existsSync(configDir)) {
    rmSync(configDir, { recursive: true, force: true });
  }
}

/**
 * Helper to ensure test config directory exists
 */
export function ensureTestConfig(testName: string): string {
  const configDir = getTestConfigDir(testName);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

/**
 * Direct API client for setup/teardown
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

/**
 * Test agent registry for cleanup
 */
const createdAgents: string[] = [];

export function registerTestAgent(did: string): void {
  createdAgents.push(did);
}

export async function cleanupTestAgents(): Promise<void> {
  // Cleanup can be implemented if the API supports deletion
  createdAgents.length = 0;
}
