/**
 * Settings Command Tests
 * Tests discoverability settings and account search
 */

const fs = require('fs-extra');
const axios = require('axios');
const settings = require('../src/commands/settings');

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn()
}));

const { loadKeys, getAgentPaths } = require('../src/lib/config');

describe('Settings Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      fingerprint: 'fp123',
      relay: 'https://relay.com'
    });
    getAgentPaths.mockReturnValue({
      configFile: '/test/config.json'
    });
    fs.readJson.mockResolvedValue({ relay: 'https://relay.com' });
    fs.writeJson.mockResolvedValue();
  });

  describe('setDiscoverable', () => {
    test('sets discoverable to true', async () => {
      axios.post.mockResolvedValue({ data: { success: true } });

      await settings.setDiscoverable(true, { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/discoverable',
        { discoverable: true },
        expect.any(Object)
      );
      expect(fs.writeJson).toHaveBeenCalled();
    });

    test('sets discoverable to false', async () => {
      axios.post.mockResolvedValue({ data: { success: true } });

      await settings.setDiscoverable(false, { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        { discoverable: false },
        expect.any(Object)
      );
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);

      await settings.setDiscoverable(true, { agent: 'nonexistent' });

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      axios.post.mockRejectedValue(new Error('Server error'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await settings.setDiscoverable(true, { agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('getDiscoverable', () => {
    test('shows discoverable status when true', async () => {
      fs.readJson.mockResolvedValue({ discoverable: true });

      await settings.getDiscoverable({ agent: 'test' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Yes'));
    });

    test('shows discoverable status when false', async () => {
      fs.readJson.mockResolvedValue({ discoverable: false });

      await settings.getDiscoverable({ agent: 'test' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No'));
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);

      await settings.getDiscoverable({ agent: 'nonexistent' });

      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('searchAccounts', () => {
    test('searches discoverable accounts', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: [
            { address: 'alice@coneko.ai', fingerprint: 'fp1', relay: 'https://relay.com', createdAt: '2024-01-01' },
            { address: 'alex@coneko.ai', fingerprint: 'fp2', relay: 'https://relay.com', createdAt: '2024-02-01' }
          ]
        }
      });

      await settings.searchAccounts('al', { agent: 'test', limit: '20' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/search',
        expect.objectContaining({
          params: { q: 'al', limit: '20' }
        })
      );
    });

    test('handles no results', async () => {
      axios.get.mockResolvedValue({ data: { results: [] } });

      await settings.searchAccounts('xyz', { agent: 'test' });

      // Spinner.info is called, not console.log directly
      expect(axios.get).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      loadKeys.mockResolvedValue(null);

      await settings.searchAccounts('test', { agent: 'nonexistent' });

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('handles 400 error for short query', async () => {
      axios.get.mockRejectedValue({ response: { status: 400 } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await settings.searchAccounts('a', { agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});
