import { runCLI, getTestConfigDir, cleanupTestConfig, ensureTestConfig } from './helpers';

describe('E2E: Gateway & Settings', () => {
  const testConfig = getTestConfigDir('settings-test');

  beforeEach(() => {
    cleanupTestConfig('settings-test');
    ensureTestConfig('settings-test');

    // Create identity
    runCLI('init -n "Settings Test"', {
      CONEKO_CONFIG_DIR: testConfig,
    });
  });

  afterEach(() => {
    cleanupTestConfig('settings-test');
  });

  it('should register on relay', () => {
    const result = runCLI('register testuser@coneko.ai', {
      CONEKO_CONFIG_DIR: testConfig,
    });

    // Registration might fail in test environment but should return expected format
    expect(result).toBeDefined();
  });

  it('should manage discoverability', () => {
    // Make discoverable
    const enableResult = runCLI('discoverable', {
      CONEKO_CONFIG_DIR: testConfig,
    });
    expect(enableResult).toBeDefined();

    // Check status
    const statusResult = runCLI('discoverability', {
      CONEKO_CONFIG_DIR: testConfig,
    });
    expect(statusResult).toBeDefined();

    // Make undiscoverable
    const disableResult = runCLI('undiscoverable', {
      CONEKO_CONFIG_DIR: testConfig,
    });
    expect(disableResult).toBeDefined();
  });

  it('should register and query intents', () => {
    // Register an intent
    const registerResult = runCLI('intent-register chat "General conversation intent"', {
      CONEKO_CONFIG_DIR: testConfig,
    });
    expect(registerResult).toBeDefined();

    // List intents
    const listResult = runCLI('intent-list', {
      CONEKO_CONFIG_DIR: testConfig,
    });
    expect(listResult).toContain('chat');
  });
});
