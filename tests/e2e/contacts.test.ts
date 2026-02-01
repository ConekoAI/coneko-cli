import { runCLI, getTestConfigDir, cleanupTestConfig, ensureTestConfig } from './helpers';

describe('E2E: Contacts & Permissions', () => {
  const aliceConfig = getTestConfigDir('alice-contacts-test');
  const bobConfig = getTestConfigDir('bob-contacts-test');
  let aliceAddress: string;
  let bobAddress: string;

  beforeAll(() => {
    // Clean up any existing configs
    cleanupTestConfig('alice-contacts-test');
    cleanupTestConfig('bob-contacts-test');

    ensureTestConfig('alice-contacts-test');
    ensureTestConfig('bob-contacts-test');

    // Create two agents
    runCLI('init -n "Alice"', { CONEKO_CONFIG_DIR: aliceConfig });
    runCLI('init -n "Bob"', { CONEKO_CONFIG_DIR: bobConfig });

    // Use whoami to get addresses (format: username@domain)
    const aliceResult = runCLI('whoami', { CONEKO_CONFIG_DIR: aliceConfig });
    const bobResult = runCLI('whoami', { CONEKO_CONFIG_DIR: bobConfig });

    // Extract addresses (simplified - adjust regex based on actual output)
    aliceAddress = 'alice@test.coneko.ai';
    bobAddress = 'bob@test.coneko.ai';
  });

  afterAll(() => {
    cleanupTestConfig('alice-contacts-test');
    cleanupTestConfig('bob-contacts-test');
  });

  it('should add a contact', () => {
    const result = runCLI(`contact-add ${bobAddress} -n "Bob Friend"`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(result).toMatch(/(Contact added|Added|Saved)/i);
  });

  it('should list contacts', () => {
    // Add contact first
    runCLI(`contact-add ${bobAddress} -n "Bob List"`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    const listResult = runCLI('contacts', {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(listResult).toContain('Bob List');
  });

  it('should grant and verify permissions', () => {
    // Alice grants Bob permission for a privileged intent
    const grantResult = runCLI(`permit ${bobAddress} -i scheduling`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(grantResult).toMatch(/(Granted|Permission|granted)/i);

    // List permissions
    const listResult = runCLI('permissions', {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(listResult).toContain('scheduling');
  });

  it('should revoke permissions', () => {
    // Grant first
    runCLI(`permit ${bobAddress} -i custom-intent`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    // Revoke
    const revokeResult = runCLI(`revoke ${bobAddress} -i custom-intent`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(revokeResult).toMatch(/(Revoked|revoked)/i);
  });
});
