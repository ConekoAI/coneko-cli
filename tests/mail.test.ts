/**
 * Mail Command Tests
 * Tests message polling and retrieval
 */

import fs from 'fs-extra';
import axios from 'axios';
import * as mail from '../src/commands/mail';
import { loadKeys, getAgentPaths, loadConfig } from '../src/lib/config';
import { decryptMessage } from '../src/lib/crypto';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn(),
  loadConfig: jest.fn(),
  ensureAgentDirs: jest.fn()
}));

jest.mock('../src/lib/crypto', () => ({
  decryptMessage: jest.fn(() => '{"sender":{"name":"Alice"},"content":{"data":"hello"}}')
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedGetAgentPaths = getAgentPaths as jest.MockedFunction<typeof getAgentPaths>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedDecryptMessage = decryptMessage as jest.MockedFunction<typeof decryptMessage>;

describe('Mail Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadKeys.mockResolvedValue({
      name: 'Test Agent',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      agentId: 'agent_123',
      keys: {
        signingPrivate: 'sign-priv',
        signingPublic: 'sign-pub',
        encryptionPrivate: 'enc-priv',
        encryptionPublic: 'enc-pub'
      },
      created: '2024-01-01'
    });
    mockedLoadConfig.mockResolvedValue({
      relay: 'https://relay.com',
      lastPoll: null,
      discoverable: false,
      registered: { address: 'test@coneko.ai', discoverable: false, registeredAt: '2024-01-01' }
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
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });

  describe('check', () => {
    test('polls messages successfully', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          messages: [
            {
              id: 'msg-1',
              from: 'alice@coneko.ai',
              content: JSON.stringify({
                ephemeralPublic: 'ephemeral',
                ciphertext: 'encrypted'
              }),
              intents: ['chat'],
              signature: 'sig',
              timestamp: '2024-01-01'
            }
          ]
        }
      });
      (axios.delete as jest.Mock).mockResolvedValue({});

      const result = await mail.check({ agent: 'test', ack: true, limit: '10', decrypt: false });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Username': 'test' }),
          params: { limit: '10' }
        })
      );
      expect(fs.writeJson).toHaveBeenCalled();
      expect(axios.delete).toHaveBeenCalledWith(
        'https://relay.com/v1/messages/msg-1',
        expect.any(Object)
      );
      expect(result.count).toBe(1);
    });

    test('handles no messages', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { messages: [] } });

      const result = await mail.check({ agent: 'test', limit: '10' });

      expect(result.count).toBe(0);
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.objectContaining({ lastPoll: expect.any(String) }),
        { spaces: 2 }
      );
    });

    test('decrypts messages when --decrypt flag provided', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            from: 'alice',
            content: JSON.stringify({ ephemeralPublic: 'ephemeral', ciphertext: 'encrypted' }),
            intents: ['chat'],
            signature: 'sig',
            timestamp: '2024-01-01'
          }]
        }
      });
      (axios.delete as jest.Mock).mockResolvedValue({});

      const result = await mail.check({ agent: 'test', decrypt: true, limit: '10' });

      expect(mockedDecryptMessage).toHaveBeenCalled();
      expect(result.count).toBe(1);
    });

    test('skips acknowledgment with --no-ack flag', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            from: 'alice',
            content: '{}',
            intents: ['chat'],
            signature: 'sig',
            timestamp: '2024-01-01'
          }]
        }
      });

      await mail.check({ agent: 'test', ack: false, limit: '10' });

      expect(axios.delete).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      const result = await mail.check({ agent: 'nonexistent', limit: '10' });

      expect(result.count).toBe(0);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('handles poll with unregistered agent', async () => {
      mockedLoadConfig.mockResolvedValue({
        relay: 'https://relay.com',
        lastPoll: null,
        discoverable: false
      });
      (axios.get as jest.Mock).mockResolvedValue({ data: { messages: [] } });

      await mail.check({ agent: 'test', limit: '10' });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Username': 'test-agent' })
        })
      );
    });

    test('handles decryption errors gracefully', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            from: 'alice',
            content: JSON.stringify({ ephemeralPublic: 'ephemeral', ciphertext: 'bad-data' }),
            intents: ['chat'],
            signature: 'sig',
            timestamp: '2024-01-01'
          }]
        }
      });
      mockedDecryptMessage.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await mail.check({ agent: 'test', decrypt: true, limit: '10' });

      expect(fs.writeJson).toHaveBeenCalled();
    });

    test('handles server error', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(mail.check({ agent: 'test', limit: '10' })).rejects.toThrow('Network error');
    });
  });
});
