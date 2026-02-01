/**
 * Contacts Command Tests
 * Tests contact management operations
 */

import axios from 'axios';
import * as contacts from '../src/commands/contacts';
import { loadKeys } from '../src/lib/config';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
  getAgentPaths: jest.fn()
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;

describe('Contacts Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadKeys.mockResolvedValue({
      name: 'Test Agent',
      relay: 'https://relay.com',
      agentId: 'agent_123',
      keys: {
        signingPrivate: 'sign-priv',
        signingPublic: 'sign-pub',
        encryptionPrivate: 'enc-priv',
        encryptionPublic: 'enc-pub'
      },
      fingerprint: 'fp123',
      created: '2024-01-01'
    });
  });

  describe('search', () => {
    test('searches accounts successfully', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          results: [
            { username: 'alice', createdAt: '2024-01-01' },
            { username: 'alex', createdAt: '2024-02-01' }
          ]
        }
      });

      await contacts.search('al', { agent: 'test' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/registry/search?q=al',
        expect.any(Object)
      );
    });

    test('handles no results', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { results: [] } });

      await contacts.search('xyz', { agent: 'test' });

      expect(axios.get).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await contacts.search('test', { agent: 'nonexistent' });

      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    test('lists contacts successfully', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          contacts: [
            { username: 'bob', name: 'Bob Smith', notes: 'Friend' },
            { username: 'charlie', name: null, notes: null }
          ]
        }
      });

      await contacts.list({ agent: 'test' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/contacts',
        expect.any(Object)
      );
    });

    test('handles empty contacts list', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { contacts: [] } });

      await contacts.list({ agent: 'test' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No contacts'));
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await contacts.list({ agent: 'nonexistent' });

      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    test('adds contact successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await contacts.add('bob@relay.com', {
        agent: 'test',
        name: 'Bob Smith',
        notes: 'My friend'
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/contacts',
        {
          contact: 'bob',
          name: 'Bob Smith',
          notes: 'My friend'
        },
        expect.any(Object)
      );
    });

    test('handles address without domain', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await contacts.add('alice', { agent: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ contact: 'alice' }),
        expect.any(Object)
      );
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await contacts.add('bob@relay.com', { agent: 'nonexistent' });

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      (axios.post as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Contact already exists' } }
      });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);

      await contacts.add('bob@relay.com', { agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('remove', () => {
    test('shows success message', async () => {
      await contacts.remove('bob@relay.com', { agent: 'test' });

      expect(console.log).toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);

      await contacts.remove('bob@relay.com', { agent: 'nonexistent' });

      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
