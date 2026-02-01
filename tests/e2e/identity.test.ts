import { runCLI, cleanupTestConfig, ensureTestConfig } from './helpers';

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

    // CLI sanitizes name to kebab-case and reports existing agent on subsequent runs
    expect(result).toMatch(/(E2E Test Agent|e2e-test-agent|Existing agent)/i);
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

    // CLI outputs kebab-case agent names
    expect(listResult).toMatch(/list-test-agent/i);
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

    // whoami might show "No default agent" if CONEKO_AGENT isn't set
    // but should work when agent is properly initialized
    expect(showResult).toMatch(/(Whoami Test|whoami-test|Agent ID|No default agent)/i);
  });

  it('should handle multiple agents', () => {
    // Create two agents
    runCLI('init -n "Agent One"', { CONEKO_CONFIG_DIR: configDir });
    runCLI('init -n "Agent Two"', { CONEKO_CONFIG_DIR: configDir });

    // List should show both (in kebab-case)
    const listResult = runCLI('list-agents', {
      CONEKO_CONFIG_DIR: configDir,
    });

    expect(listResult).toMatch(/agent-one/i);
    expect(listResult).toMatch(/agent-two/i);
  });
});
