/**
 * Gateway Command Tests
 * Tests OpenClaw gateway setup
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as gateway from '../src/commands/gateway';
import { loadKeys, getAgentPaths } from '../src/lib/config';

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn()
}));

const mockedLoadKeys = loadKeys as jest.MockedFunction<typeof loadKeys>;
const mockedGetAgentPaths = getAgentPaths as jest.MockedFunction<typeof getAgentPaths>;

describe('Gateway Commands', () => {
  const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');

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
    mockedGetAgentPaths.mockReturnValue({
      baseDir: '/test/.coneko',
      agentDir: '/test/agent',
      keysFile: '/test/agent/keys.json',
      configFile: '/test/agent/config.json',
      contactsFile: '/test/agent/contacts.json',
      permissionsFile: '/test/agent/permissions.json',
      polledDir: '/test/agent/polled',
      readDir: '/test/agent/read',
      stateFile: '/test/agent/state.json'
    });
    (fs.pathExists as jest.Mock).mockResolvedValue(false);
    (fs.readJson as jest.Mock).mockResolvedValue({ agents: { list: [] } });
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
    (fs.copy as jest.Mock).mockResolvedValue(undefined);
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
  });

  describe('setup', () => {
    test('fails when OpenClaw not installed', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);

      await gateway.setup({ agent: 'test' });

      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    test('creates coneko-gateway agent configuration', async () => {
      (fs.pathExists as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'test' });

      expect(fs.copy).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalledWith(
        OPENCLAW_CONFIG,
        expect.objectContaining({
          agents: expect.objectContaining({
            list: expect.arrayContaining([
              expect.objectContaining({
                id: 'coneko-gateway',
                name: 'Coneko Gateway'
              })
            ])
          })
        }),
        { spaces: 2 }
      );
    });

    test('updates existing coneko-gateway agent', async () => {
      (fs.pathExists as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      (fs.readJson as jest.Mock).mockResolvedValue({
        agents: {
          list: [{ id: 'coneko-gateway', name: 'Old Name' }]
        }
      });

      await gateway.setup({ agent: 'test' });

      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          agents: expect.objectContaining({
            list: expect.arrayContaining([
              expect.objectContaining({ id: 'coneko-gateway' })
            ])
          })
        }),
        { spaces: 2 }
      );
    });

    test('creates workspace with required files', async () => {
      (fs.pathExists as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'test' });

      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('IDENTITY.md'),
        expect.stringContaining('coneko-gateway')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('AGENTS.md'),
        expect.stringContaining('restricted agent')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('USER.md'),
        expect.any(String)
      );
    });

    test('handles errors gracefully', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as never);

      await gateway.setup({ agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('uses specified agent when provided', async () => {
      (fs.pathExists as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'myagent' });

      expect(loadKeys).toHaveBeenCalledWith('myagent');
    });

    test('creates INBOXES.md reference file', async () => {
      (fs.pathExists as jest.Mock).mockImplementation((p: string) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'test' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('CONEKO_INBOXES.md'),
        expect.stringContaining('coneko directories')
      );
    });
  });
});
