/**
 * Intents Command Tests
 * Tests intent registration, listing, and querying
 */

const fs = require('fs-extra');
const axios = require('axios');
const intents = require('../src/commands/intents');

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  loadConfig: jest.fn(),
  saveConfig: jest.fn()
}));

const { loadKeys, loadConfig, saveConfig } = require('../src/lib/config');

describe('Intents Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      relay: 'https://relay.com',
      keys: { signingPrivate: 'key' }
    });
    loadConfig.mockResolvedValue({ relay: 'https://relay.com' });
  });

  describe('registerIntent', () => {
    test('registers intent successfully', async () => {
      axios.post.mockResolvedValue({ data: { success: true } });
      
      await intents.registerIntent('calendar', 'Calendar access', { agent: 'test', privileged: false });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/intents/register',
        { name: 'calendar', description: 'Calendar access', privileged: false },
        expect.any(Object)
      );
      expect(saveConfig).toHaveBeenCalled();
    });

    test('registers privileged intent', async () => {
      axios.post.mockResolvedValue({ data: { success: true } });
      
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
      loadKeys.mockResolvedValue(null);
      
      await intents.registerIntent('test', 'Test', { agent: 'nonexistent' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      axios.post.mockRejectedValue({ response: { data: { error: 'Server error' } } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      await intents.registerIntent('test', 'Test', { agent: 'test' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('listIntents', () => {
    test('lists intents successfully', async () => {
      axios.get.mockResolvedValue({
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
      axios.get.mockResolvedValue({ data: { intents: {} } });
      
      await intents.listIntents({ agent: 'test' });
      
      expect(console.log).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);
      
      await intents.listIntents({ agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('removeIntent', () => {
    test('removes intent successfully', async () => {
      axios.delete.mockResolvedValue({ data: { success: true } });
      loadConfig.mockResolvedValue({ intents: { custom: {} } });
      
      await intents.removeIntent('custom', { agent: 'test' });
      
      expect(axios.delete).toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalled();
    });

    test('prevents removal of default intent', async () => {
      await intents.removeIntent('chat', { agent: 'test' });
      
      expect(axios.delete).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);
      
      await intents.removeIntent('test', { agent: 'nonexistent' });
      
      expect(axios.delete).not.toHaveBeenCalled();
    });
  });

  describe('queryIntents', () => {
    test('queries intents for address', async () => {
      axios.get.mockResolvedValue({
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
      axios.get.mockRejectedValue({ response: { status: 404 } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      await intents.queryIntents('unknown@relay.com', { agent: 'test' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);
      
      await intents.queryIntents('other@relay.com', { agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
});
