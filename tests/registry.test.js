/**
 * Registry Command Tests
 * Tests DNS-style address registration and resolution
 */

const fs = require('fs-extra');
const axios = require('axios');
const registry = require('../src/commands/registry');

jest.mock('../src/lib/config');
jest.mock('../src/lib/crypto', () => ({
  signMessage: jest.fn(() => 'signature-base64')
}));

const { loadKeys, getAgentPaths } = require('../src/lib/config');

describe('Registry Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      agentId: 'agent_123',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      keys: {
        signingPrivate: 'sign-priv',
        encryptionPublic: 'enc-pub'
      }
    });
    
    getAgentPaths.mockReturnValue({
      agentDir: '/test/agent',
      configFile: '/test/config.json',
      contactsFile: '/test/contacts.json'
    });
    
    fs.readJson.mockResolvedValue({});
    fs.writeJson.mockResolvedValue();
  });

  describe('register', () => {
    beforeEach(() => {
      // Setup axios mock for each test
      axios.post.mockResolvedValue({
        data: {
          address: 'testuser@coneko.ai',
          fingerprint: 'fp123',
          discoverable: false
        }
      });
    });

    test('registers address successfully', async () => {
      await registry.register('testuser@coneko.ai', { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/register',
        expect.objectContaining({
          username: 'testuser',
          domain: 'coneko.ai',
          fingerprint: 'fp123',
          public_key: 'enc-pub'
        }),
        expect.any(Object)
      );
    });

    test('uses default domain when not specified', async () => {
      await registry.register('testuser', { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ domain: 'coneko.ai' }),
        expect.any(Object)
      );
    });

    test('registers with discoverable flag', async () => {
      await registry.register('test@coneko.ai', { agent: 'test', discoverable: true });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ discoverable: true }),
        expect.any(Object)
      );
    });

    test('fails with invalid address format', async () => {
      await registry.register('', { agent: 'test' });
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);
      await registry.register('test@coneko.ai', { agent: 'nonexistent' });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      axios.get.mockResolvedValue({
        data: {
          username: 'alice',
          domain: 'coneko.ai',
          fingerprint: 'alice-fp',
          public_key: 'alice-pub-key',
          relay_url: 'https://relay.com',
          created_at: '2024-01-01'
        }
      });
    });

    test('resolves address successfully', async () => {
      await registry.resolve('alice@coneko.ai', { agent: 'test' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/lookup/alice%40coneko.ai',
        expect.any(Object)
      );
    });

    test('adds contact when --add flag provided', async () => {
      fs.readJson.mockResolvedValue({ contacts: {} });
      await registry.resolve('bob@coneko.ai', { agent: 'test', add: true });
      expect(fs.writeJson).toHaveBeenCalled();
    });
  });

  describe('whois', () => {
    beforeEach(() => {
      axios.get.mockResolvedValue({
        data: {
          registrations: [
            { address: 'alice@coneko.ai', relay_url: 'https://relay.com' }
          ]
        }
      });
    });

    test('looks up fingerprint successfully', async () => {
      await registry.whois('fingerprint123', { agent: 'test' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/reverse/fingerprint123',
        expect.any(Object)
      );
    });

    test('uses custom relay URL', async () => {
      await registry.whois('fp123', { relay: 'https://custom.relay.com' });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('custom.relay.com'),
        expect.any(Object)
      );
    });
  });
});
