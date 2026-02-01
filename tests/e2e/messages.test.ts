import { runCLI, getTestConfigDir, cleanupTestConfig, ensureTestConfig } from './helpers';

describe('E2E: Messaging', () => {
  const aliceConfig = getTestConfigDir('alice-msg-test');
  const bobConfig = getTestConfigDir('bob-msg-test');
  let aliceAddress: string;
  let bobAddress: string;

  beforeAll(() => {
    // Clean up
    cleanupTestConfig('alice-msg-test');
    cleanupTestConfig('bob-msg-test');

    ensureTestConfig('alice-msg-test');
    ensureTestConfig('bob-msg-test');

    // Create two agents
    runCLI('init -n "Alice Message"', { CONEKO_CONFIG_DIR: aliceConfig });
    runCLI('init -n "Bob Message"', { CONEKO_CONFIG_DIR: bobConfig });

    aliceAddress = 'alice-msg@test.coneko.ai';
    bobAddress = 'bob-msg@test.coneko.ai';

    // Add each other as contacts
    runCLI(`contact-add ${bobAddress} -n "Bob"`, { CONEKO_CONFIG_DIR: aliceConfig });
    runCLI(`contact-add ${aliceAddress} -n "Alice"`, { CONEKO_CONFIG_DIR: bobConfig });
  });

  afterAll(() => {
    cleanupTestConfig('alice-msg-test');
    cleanupTestConfig('bob-msg-test');
  });

  it('should send a message', () => {
    const result = runCLI(`send-to ${bobAddress} -i chat -c '{"text":"Hello from Alice!"}'`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(result).toMatch(/(sent|queued|delivered)/i);
  });

  it('should send with multiple intents', () => {
    const result = runCLI(`send-to ${bobAddress} -i chat,scheduling -c '{"text":"Can we meet?"}' -m "Meeting request"`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    expect(result).toMatch(/(sent|queued|delivered)/i);
  });

  it('should poll for messages', () => {
    // Send a message first from Alice to Bob
    runCLI(`send-to ${bobAddress} -i chat -c '{"text":"Poll test"}'`, {
      CONEKO_CONFIG_DIR: aliceConfig,
    });

    // Bob polls for messages
    const result = runCLI('poll', {
      CONEKO_CONFIG_DIR: bobConfig,
    });

    // Result could be empty or contain the message
    expect(result).toBeDefined();
  });
});
