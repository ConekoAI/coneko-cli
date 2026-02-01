/**
 * Intents Command Tests
 * Tests intent registration, listing, and querying
 */

import axios from 'axios';
import * as intents from '../src/commands/intents';
import { loadKeys, loadConfig, saveConfig } from '../src/lib/config';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  loadConfig: jest.fn(),
  saveConfig: jest.fn()
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

describe('Intents Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadKeys.mockResolvedValue({
      name: 'Test Agent',
      relay: 'https://relay.com',
      agentId: 'agent_123',
      keys: {
        signingPrivate: 'key',
        signingPublic: 'pub',
        encryptionPrivate: 'enc-priv',
        encryptionPublic: 'enc-pub'
      },
      fingerprint: 'fp123',
      created: '2024-01-01'
    });
    mockedLoadConfig.mockResolvedValue({ relay: 'https://relay.com', lastPoll: null, discoverable: false });
  });

  describe('registerIntent', () => {
    test('registers intent successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      await intents.registerIntent('calendar', 'Calendar access', { agent: 'test', privileged: false });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/intents/register',
        { name: 'calendar', description: 'Calendar access', privileged: false },
        expect.any(Object)
      );
      expect(saveConfig).toHaveBeenCalled();
    });

    test('registers privileged intent', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      await intents.registerIntent('admin', 'Admin tasks', { agent: 'test', privileged: true });
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ privileged: true }),
        expect.any(Object)
      );
    });

    test('validates intent name format', async () => {
      await intents.registerIntent('invalid name!', 'Description', { agent: 'test' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await intents.registerIntent('test', 'Test', { agent: 'nonexistent' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      (axios.post as jest.Mock).mockRejectedValue({ response: { data: { error: 'Server error' } } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);
      
      await intents.registerIntent('test', 'Test', { agent: 'test' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('listIntents', () => {
    test('lists intents successfully', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          intents: {
            chat: { description: 'Chat', privileged: false },
            admin: { description: 'Admin', privileged: true }
          }
        }
      });
      
      await intents.listIntents({ agent: 'test' });
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/intents/test-agent',
        expect.any(Object)
      );
    });

    test('handles empty intents list', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { intents: {} } });
      
      await intents.listIntents({ agent: 'test' });
      
      expect(console.log).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await intents.listIntents({ agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('removeIntent', () => {
    test('removes intent successfully', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ data: { success: true } });
      mockedLoadConfig.mockResolvedValue({ relay: 'https://relay.com', lastPoll: null, discoverable: false, intents: { custom: {} } });
      
      await intents.removeIntent('custom', { agent: 'test' });
      
      expect(axios.delete).toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalled();
    });

    test('prevents removal of default intent', async () => {
      await intents.removeIntent('chat', { agent: 'test' });
      
      expect(axios.delete).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await intents.removeIntent('test', { agent: 'nonexistent' });
      
      expect(axios.delete).not.toHaveBeenCalled();
    });
  });

  describe('queryIntents', () => {
    test('queries intents for address', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          intents: {
            chat: { description: 'Chat', privileged: false },
            private: { description: 'Private', privileged: true }
          }
        }
      });
      
      await intents.queryIntents('other@relay.com', { agent: 'test' });
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/intents/other',
        expect.any(Object)
      );
    });

    test('handles 404 not found', async () => {
      (axios.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);
      
      await intents.queryIntents('unknown@relay.com', { agent: 'test' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await intents.queryIntents('other@relay.com', { agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
});
