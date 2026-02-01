/**
 * Permissions Command Tests
 * Tests permission granting, revoking, and listing
 */

import axios from 'axios';
import * as permissions from '../src/commands/permissions';
import { loadKeys } from '../src/lib/config';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn(),
  loadConfig: jest.fn()
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;

describe('Permissions Commands', () => {
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
  });

  describe('grantPermission', () => {
    test('grants permission successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      await permissions.grantPermission('bob', { agent: 'test', intent: 'admin' });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/permissions/grant',
        { grantee: 'bob', intent: 'admin' },
        expect.any(Object)
      );
    });

    test('requires intent option', async () => {
      await permissions.grantPermission('bob', { agent: 'test', intent: '' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await permissions.grantPermission('bob', { agent: 'nonexistent', intent: 'admin' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('handles server error', async () => {
      (axios.post as jest.Mock).mockRejectedValue({ response: { data: { error: 'Intent not found' } } });
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);
      
      await permissions.grantPermission('bob', { agent: 'test', intent: 'admin' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('revokePermission', () => {
    test('revokes permission successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      await permissions.revokePermission('bob', { agent: 'test', intent: 'admin' });
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://relay.com/v1/permissions/revoke',
        { grantee: 'bob', intent: 'admin' },
        expect.any(Object)
      );
    });

    test('requires intent option', async () => {
      await permissions.revokePermission('bob', { agent: 'test', intent: '' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await permissions.revokePermission('bob', { agent: 'nonexistent', intent: 'admin' });
      
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('listGrantedPermissions', () => {
    test('lists granted permissions', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          permissions: {
            bob: ['admin', 'calendar'],
            charlie: ['chat']
          }
        }
      });
      
      await permissions.listGrantedPermissions({ agent: 'test' });
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/permissions/granted',
        expect.any(Object)
      );
    });

    test('handles empty permissions', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { permissions: {} } });
      
      await permissions.listGrantedPermissions({ agent: 'test' });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No permissions'));
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await permissions.listGrantedPermissions({ agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('listReceivedPermissions', () => {
    test('lists received permissions', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          permissions: {
            alice: ['admin'],
            dave: ['calendar', 'tasks']
          }
        }
      });
      
      await permissions.listReceivedPermissions({ agent: 'test' });
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://relay.com/v1/permissions/received',
        expect.any(Object)
      );
    });

    test('handles empty permissions', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { permissions: {} } });
      
      await permissions.listReceivedPermissions({ agent: 'test' });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No permissions'));
    });

    test('fails when agent not found', async () => {
      mockedLoadKeys.mockResolvedValue(null);
      
      await permissions.listReceivedPermissions({ agent: 'nonexistent' });
      
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
});
