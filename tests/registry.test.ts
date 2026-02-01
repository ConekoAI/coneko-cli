/**
 * Registry Command Tests
 * Tests DNS-style address registration and resolution
 */

import fs from 'fs-extra';
import axios from 'axios';
import * as registry from '../src/commands/registry';
import { loadKeys, getAgentPaths } from '../src/lib/config';

jest.mock('../src/lib/config');
jest.mock('../src/lib/crypto', () => ({
  signMessage: jest.fn(() => 'signature-base64')
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedGetAgentPaths = getAgentPaths as jest.MockedFunction<typeof getAgentPaths>;

describe('Registry Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    mockedLoadKeys.mockResolvedValue({
      name: 'Test Agent',
      agentId: 'agent_123',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      keys: {
        signingPrivate: 'sign-priv',
        signingPublic: 'sign-pub',
        encryptionPrivate: 'enc-priv',
        encryptionPublic: 'enc-pub'
      },
      created: '2024-01-01'
    });
    
    mockedGetAgentPaths.mockReturnValue({
      baseDir: '/test/.coneko',
      agentDir: '/test/agent',
      configFile: '/test/config.json',
      keysFile: '/test/keys.json',
      contactsFile: '/test/contacts.json',
      permissionsFile: '/test/permissions.json',
      polledDir: '/test/agent/polled',
      readDir: '/test/agent/read',
      stateFile: '/test/state.json'
    });
    
    (fs.readJson as jest.Mock).mockResolvedValue({});
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });

  describe('register', () => {
    beforeEach(() => {
      (axios.post as jest.Mock).mockResolvedValue({
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
      mockedLoadKeys.mockResolvedValue(null);
      await registry.register('test@coneko.ai', { agent: 'nonexistent' });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      (axios.get as jest.Mock).mockResolvedValue({
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
      (fs.readJson as jest.Mock).mockResolvedValue({ contacts: {} });
      await registry.resolve('bob@coneko.ai', { agent: 'test', add: true });
      expect(fs.writeJson).toHaveBeenCalled();
    });
  });

  describe('whois', () => {
    beforeEach(() => {
      (axios.get as jest.Mock).mockResolvedValue({
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
