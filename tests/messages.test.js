/**
 * Messages Command Tests
 * Tests message sending with intent validation
 */

const fs = require('fs-extra');
const axios = require('axios');
const messages = require('../src/commands/messages');
const { signMessage, encryptMessage } = require('../src/lib/crypto');

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn()
}));

jest.mock('../src/lib/crypto', () => ({
  signMessage: jest.fn(() => 'signature-base64'),
  encryptMessage: jest.fn(() => ({
    ephemeralPublic: 'ephemeral-key',
    ciphertext: 'encrypted-data'
  }))
}));

const { loadKeys, getAgentPaths } = require('../src/lib/config');

describe('Messages Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      agentId: 'agent_123',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      keys: {
        signingPrivate: 'sign-priv',
        encryptionPrivate: 'enc-priv'
      }
    });
    getAgentPaths.mockReturnValue({
      contactsFile: '/test/contacts.json'
    });
    fs.readJson.mockResolvedValue({
      contacts: {
        'recipient-fp': {
          name: 'recipient@relay.com',
          publicKey: 'recipient-pub-key'
        }
      }
    });
  });

  describe('send', () => {
    test('sends message successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'chat', allowed: true }] }
      });
      axios.post.mockResolvedValueOnce({
        data: { messageId: 'msg-123', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        message: 'Hello there',
        agent: 'test'
      });
      
      expect(result).toEqual({ sent: true, messageId: 'msg-123' });
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(signMessage).toHaveBeenCalled();
      expect(encryptMessage).toHaveBeenCalled();
    });

    test('sends message with multiple intents', async () => {
      axios.post.mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'chat' }, { name: 'task' }] }
      });
      axios.post.mockResolvedValueOnce({
        data: { messageId: 'msg-456', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat,task',
        content: '{"action":"do something"}',
        agent: 'test'
      });
      
      expect(result.sent).toBe(true);
    });

    test('returns bounced when intent not allowed', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          allowed: false,
          blocked_intents: [{ name: 'admin', reason: 'Permission required' }]
        }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'admin',
        content: '{"cmd":"secret"}',
        agent: 'test'
      });
      
      expect(result.bounced).toBe(true);
      expect(result.blockedIntents).toContainEqual(expect.objectContaining({ name: 'admin' }));
    });

    test('fails when contact not found', async () => {
      await messages.send({
        to: 'unknown-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'test'
      });
      
      expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining('/v1/messages'), expect.anything());
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);
      
      await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'nonexistent'
      });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles 403 bounced from relay', async () => {
      // First call (intent check) succeeds
      axios.post.mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'privileged', allowed: true }] }
      });
      // Second call (send message) fails with 403
      axios.post.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: 'Message blocked',
            blocked_intents: [{ name: 'privileged', reason: 'No permission' }]
          }
        }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'privileged',
        content: '{"secret":"data"}',
        agent: 'test'
      });
      
      expect(result.bounced).toBe(true);
    });

    test('handles server error', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'test'
      });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('continues when intent check fails', async () => {
      axios.post.mockRejectedValueOnce(new Error('Check failed'));
      axios.post.mockResolvedValueOnce({
        data: { messageId: 'msg-789', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'test'
      });
      
      expect(result.sent).toBe(true);
    });
  });
});
