/**
 * Settings Command Tests
 * Tests discoverability settings and account search
 */

import fs from 'fs-extra';
import axios from 'axios';
import * as settings from '../src/commands/settings';
import { loadKeys, getAgentPaths } from '../src/lib/config';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn()
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedGetAgentPaths = getAgentPaths as jest.MockedFunction<typeof getAgentPaths>;

describe('Settings Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadKeys.mockResolvedValue({
      name: 'Test Agent',
      fingerprint: 'fp123',
      relay: 'https://relay.com',
      agentId: 'agent_123',
      keys: {
        signingPrivate: 'key',
        signingPublic: 'pub',
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
    (fs.readJson as jest.Mock).mockResolvedValue({ relay: 'https://relay.com', lastPoll: null, discoverable: false });
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });

  describe('setDiscoverable', () => {
    test('sets discoverable to true', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await settings.setDiscoverable(true, { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/discoverable',
        { discoverable: true },
        expect.any(Object)
      );
      expect(fs.writeJson).toHaveBeenCalled();
    });

    test('sets discoverable to false', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await settings.setDiscoverable(false, { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        { discoverable: false },
        expect.any(Object)
      );
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await settings.setDiscoverable(true, { agent: 'nonexistent' });

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Server error'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);

      await settings.setDiscoverable(true, { agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('getDiscoverable', () => {
    test('shows discoverable status when true', async () => {
      (fs.readJson as jest.Mock).mockResolvedValue({ discoverable: true });

      await settings.getDiscoverable({ agent: 'test' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Yes'));
    });

    test('shows discoverable status when false', async () => {
      (fs.readJson as jest.Mock).mockResolvedValue({ discoverable: false });

      await settings.getDiscoverable({ agent: 'test' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No'));
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await settings.getDiscoverable({ agent: 'nonexistent' });

      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('searchAccounts', () => {
    test('searches discoverable accounts', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
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
      (axios.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

      await settings.searchAccounts('xyz', { agent: 'test' });

      expect(axios.get).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await settings.searchAccounts('test', { agent: 'nonexistent' });

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('handles 400 error for short query', async () => {
      (axios.get as jest.Mock).mockRejectedValue({ response: { status: 400 } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);

      await settings.searchAccounts('a', { agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});
