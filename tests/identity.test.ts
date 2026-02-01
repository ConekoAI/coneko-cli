/**
 * Identity Command Tests
 * Tests agent initialization and identity management
 */

import fs from 'fs-extra';
import * as identity from '../src/commands/identity';

// Mock crypto module
jest.mock('../src/lib/crypto', () => ({
  generateKeyPair: jest.fn(() => ({
    signingPrivate: 'sign-priv-base64',
    signingPublic: 'sign-pub-base64',
    encryptionPrivate: 'enc-priv-base64',
    encryptionPublic: 'enc-pub-base64'
  })),
  getFingerprint: jest.fn(() => 'testfingerprint123')
}));

describe('Identity Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    test('creates new agent successfully', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      await identity.init({ name: 'Test Agent', relay: 'https://relay.com' });
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('keys.json'),
        expect.objectContaining({
          name: 'Test Agent',
          fingerprint: 'testfingerprint123',
          relay: 'https://relay.com'
        }),
        { spaces: 2 }
      );
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('contacts.json'),
        { contacts: {} },
        { spaces: 2 }
      );
    });

    test('sanitizes agent name', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      await identity.init({ name: 'My Test Agent!', relay: 'https://relay.com' });
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          agentId: expect.stringMatching(/^agent_/)
        }),
        { spaces: 2 }
      );
    });

    test('handles already initialized agent', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        name: 'Existing Agent',
        fingerprint: 'existingfp'
      });
      
      await identity.init({ name: 'Test Agent', relay: 'https://relay.com' });
      
      // Should not write new keys
      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    test('handles errors gracefully', async () => {
      (fs.pathExists as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);
      
      await identity.init({ name: 'Test Agent', relay: 'https://relay.com' });
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('whoami', () => {
    test('displays agent info when found', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        name: 'Test Agent',
        agentId: 'agent_123',
        fingerprint: 'fp123',
        relay: 'https://relay.com',
        created: '2024-01-01'
      });
      
      await identity.whoami({ agent: 'testagent' });
      
      // Should not show error
      expect(console.error).not.toHaveBeenCalled();
    });

    test('shows message when agent not found', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      await identity.whoami({ agent: 'nonexistent' });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No agent'));
    });

    test('shows other agents when multiple exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({
        name: 'Test Agent',
        fingerprint: 'fp123'
      });
      
      // Mock listAgents by mocking the module
      jest.mock('../src/lib/config', () => ({
        ...jest.requireActual('../src/lib/config'),
        listAgents: jest.fn().mockResolvedValue(['agent1', 'agent2'])
      }));
      
      await identity.whoami({});
      
      expect(console.log).toHaveBeenCalled();
    });
  });
});
