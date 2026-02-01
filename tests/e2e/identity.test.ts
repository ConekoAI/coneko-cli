import { runCLI, getTestConfigDir, cleanupTestConfig, ensureTestConfig } from './helpers';

describe('E2E: Identity Management', () => {
  const testName = 'identity-test';
  let configDir: string;

  beforeEach(() => {
    cleanupTestConfig(testName);
    configDir = ensureTestConfig(testName);
  });

  afterEach(() => {
    cleanupTestConfig(testName);
  });

  it('should initialize a new agent identity', () => {
    const result = runCLI('init -n "E2E Test Agent"', {
      CONEKO_CONFIG_DIR: configDir,
    });

    expect(result).toContain('E2E Test Agent');
    expect(result).toMatch(/(Agent created|Initialized|Identity)/i);
  });

  it('should list created agents', () => {
    // Create an agent first
    runCLI('init -n "List Test Agent"', {
      CONEKO_CONFIG_DIR: configDir,
    });

    // List agents
    const listResult = runCLI('list-agents', {
      CONEKO_CONFIG_DIR: configDir,
    });

    expect(listResult).toContain('List Test Agent');
  });

  it('should show current identity with whoami', () => {
    // Create an identity
    runCLI('init -n "Whoami Test"', {
      CONEKO_CONFIG_DIR: configDir,
    });

    // Get identity details
    const showResult = runCLI('whoami', {
      CONEKO_CONFIG_DIR: configDir,
    });

    expect(showResult).toContain('Whoami Test');
  });

  it('should handle multiple agents', () => {
    // Create two agents
    runCLI('init -n "Agent One"', { CONEKO_CONFIG_DIR: configDir });
    runCLI('init -n "Agent Two"', { CONEKO_CONFIG_DIR: configDir });

    // List should show both
    const listResult = runCLI('list-agents', {
      CONEKO_CONFIG_DIR: configDir,
    });

    expect(listResult).toContain('Agent One');
    expect(listResult).toContain('Agent Two');
  });
});
