/**
 * Messages Command Tests
 * Tests message sending with intent validation
 */

import fs from 'fs-extra';
import axios from 'axios';
import * as messages from '../src/commands/messages';
import { loadKeys, getAgentPaths } from '../src/lib/config';
import { signMessage, encryptMessage } from '../src/lib/crypto';

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

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedGetAgentPaths = getAgentPaths as jest.MockedFunction<typeof getAgentPaths>;
const mockedSignMessage = signMessage as jest.MockedFunction<typeof signMessage>;
const mockedEncryptMessage = encryptMessage as jest.MockedFunction<typeof encryptMessage>;

describe('Messages Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (fs.readJson as jest.Mock).mockResolvedValue({
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
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'chat', allowed: true }] }
      });
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { messageId: 'msg-123', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        message: 'Hello there',
        agent: 'test'
      });
      
      expect(result).toEqual({ success: true, messageId: 'msg-123' });
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(mockedSignMessage).toHaveBeenCalled();
      expect(mockedEncryptMessage).toHaveBeenCalled();
    });

    test('sends message with multiple intents', async () => {
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'chat' }, { name: 'task' }] }
      });
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { messageId: 'msg-456', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat,task',
        content: '{"action":"do something"}',
        agent: 'test'
      });
      
      expect(result.success).toBe(true);
    });

    test('returns bounced when intent not allowed', async () => {
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          allowed: false,
          blocked_intents: ['admin']
        }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'admin',
        content: '{"cmd":"secret"}',
        agent: 'test'
      });
      
      expect(result.bounced).toBe(true);
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
      mockedLoadKeys.mockResolvedValue(null);
      
      await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'nonexistent'
      });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles 403 bounced from relay', async () => {
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { allowed: true, allowed_intents: [{ name: 'privileged', allowed: true }] }
      });
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: 'Message blocked',
            blocked_intents: ['privileged']
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
      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);
      
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
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('Check failed'));
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { messageId: 'msg-789', status: 'queued' }
      });
      
      const result = await messages.send({
        to: 'recipient-fp',
        intent: 'chat',
        content: '{"text":"Hello"}',
        agent: 'test'
      });
      
      expect(result.success).toBe(true);
    });
  });
});
