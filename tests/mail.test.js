/**
 * Mail Command Tests
 * Tests message polling and retrieval
 */

const fs = require('fs-extra');
const axios = require('axios');
const mail = require('../src/commands/mail');
const { decryptMessage } = require('../src/lib/crypto');

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn(),
  loadConfig: jest.fn(),
  ensureAgentDirs: jest.fn()
}));

jest.mock('../src/lib/crypto', () => ({
  decryptMessage: jest.fn(() => '{"sender":{"name":"Alice"},"content":{"data":"hello"}}')
}));

const { loadKeys, getAgentPaths, loadConfig, ensureAgentDirs } = require('../src/lib/config');

describe('Mail Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      keys: {
        encryptionPrivate: 'enc-priv'
      }
    });
    loadConfig.mockResolvedValue({
      relay: 'https://relay.com',
      registered: { address: 'test@coneko.ai' }
    });
    getAgentPaths.mockReturnValue({
      agentDir: '/test/agent',
      configFile: '/test/config.json',
      polledDir: '/test/agent/polled'
    });
    fs.writeJson.mockResolvedValue();
  });

  describe('check', () => {
    test('polls messages successfully', async () => {
      axios.get.mockResolvedValue({
        data: {
          messages: [
            {
              id: 'msg-1',
              sender: 'alice@coneko.ai',
              payload: JSON.stringify({
                ephemeralPublic: 'ephemeral',
                ciphertext: 'encrypted'
              }),
              intents: '[{"name":"chat"}]',
              createdAt: '2024-01-01',
              expiresAt: '2024-02-01'
            }
          ]
        }
      });
      axios.delete.mockResolvedValue({});

      const result = await mail.check({ agent: 'test', noAck: false, limit: 10 });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Username': 'test' }),
          params: { limit: 10 }
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
      axios.get.mockResolvedValue({ data: { messages: [] } });

      const result = await mail.check({ agent: 'test' });

      expect(result.count).toBe(0);
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.objectContaining({ lastPoll: expect.any(String) }),
        { spaces: 2 }
      );
    });

    test('decrypts messages when --decrypt flag provided', async () => {
      axios.get.mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            sender: 'alice',
            payload: JSON.stringify({ ephemeralPublic: 'ephemeral', ciphertext: 'encrypted' }),
            intents: '[]'
          }]
        }
      });
      axios.delete.mockResolvedValue({});

      const result = await mail.check({ agent: 'test', decrypt: true });

      expect(decryptMessage).toHaveBeenCalled();
      expect(result.count).toBe(1);
    });

    test('skips acknowledgment with --no-ack flag', async () => {
      axios.get.mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            sender: 'alice',
            payload: '{}',
            intents: '[]'
          }]
        }
      });

      await mail.check({ agent: 'test', noAck: true });

      expect(axios.delete).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);

      const result = await mail.check({ agent: 'nonexistent' });

      expect(result.count).toBe(0);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('handles poll with unregistered agent', async () => {
      loadConfig.mockResolvedValue({
        relay: 'https://relay.com'
        // No registered address
      });
      axios.get.mockResolvedValue({ data: { messages: [] } });

      await mail.check({ agent: 'test' });

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Username': 'test-agent' })
        })
      );
    });

    test('handles decryption errors gracefully', async () => {
      axios.get.mockResolvedValue({
        data: {
          messages: [{
            id: 'msg-1',
            sender: 'alice',
            payload: JSON.stringify({ ephemeralPublic: 'ephemeral', ciphertext: 'bad-data' }),
            intents: '[]'
          }]
        }
      });
      decryptMessage.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await mail.check({ agent: 'test', decrypt: true });

      // Should not throw, just mark error in message data
      expect(fs.writeJson).toHaveBeenCalled();
    });

    test('handles server error', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(mail.check({ agent: 'test' })).rejects.toThrow('Network error');
    });
  });
});
