/**
 * Config Module Tests
 * Tests configuration management and file operations
 */

import fs from 'fs-extra';
import {
  getAgentDir,
  getAgentPaths,
  ensureAgentDirs,
  loadKeys,
  loadConfig,
  saveConfig,
  listAgents
} from '../src/lib/config';

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONEKO_AGENT;
  });

  describe('getAgentDir', () => {
    test('returns path with agent name', () => {
      const dir = getAgentDir('myagent');
      expect(dir).toContain('myagent');
      expect(dir).toContain('.coneko');
    });

    test('sanitizes agent name', () => {
      const dir = getAgentDir('My Agent!');
      expect(dir).toContain('my-agent-');
    });

    test('uses CONEKO_AGENT env var when no name provided', () => {
      process.env.CONEKO_AGENT = 'envagent';
      const dir = getAgentDir();
      expect(dir).toContain('envagent');
    });

    test('defaults to "default" when no agent specified', () => {
      delete process.env.CONEKO_AGENT;
      const dir = getAgentDir();
      expect(dir).toContain('default');
    });
  });

  describe('getAgentPaths', () => {
    test('returns all required paths', () => {
      const paths = getAgentPaths('testagent');
      
      expect(paths).toHaveProperty('baseDir');
      expect(paths).toHaveProperty('agentDir');
      expect(paths).toHaveProperty('keysFile');
      expect(paths).toHaveProperty('configFile');
      expect(paths).toHaveProperty('contactsFile');
      expect(paths).toHaveProperty('permissionsFile');
      expect(paths).toHaveProperty('polledDir');
      expect(paths).toHaveProperty('readDir');
      expect(paths).toHaveProperty('stateFile');
    });

    test('paths include agent name', () => {
      const paths = getAgentPaths('myagent');
      expect(paths.agentDir).toContain('myagent');
      expect(paths.keysFile).toContain('keys.json');
      expect(paths.configFile).toContain('config.json');
    });
  });

  describe('ensureAgentDirs', () => {
    test('creates all required directories', async () => {
      await ensureAgentDirs('testagent');
      
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('testagent'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('polled'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('read'));
    });

    test('returns agent paths', async () => {
      const paths = await ensureAgentDirs('testagent');
      
      expect(paths).toHaveProperty('keysFile');
      expect(paths).toHaveProperty('configFile');
    });
  });

  describe('loadKeys', () => {
    test('returns keys when file exists', async () => {
      const mockKeys = {
        agentId: 'test123',
        name: 'Test Agent',
        keys: { signingPublic: 'abc123' },
        fingerprint: 'fp123',
        created: '2024-01-01'
      };
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(mockKeys);
      
      const keys = await loadKeys('testagent');
      
      expect(keys).toEqual(mockKeys);
    });

    test('returns null when file does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      const keys = await loadKeys('testagent');
      
      expect(keys).toBeNull();
    });
  });

  describe('loadConfig', () => {
    test('returns config when file exists', async () => {
      const mockConfig = { relay: 'https://custom.relay.com', lastPoll: null, discoverable: false };
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(mockConfig);
      
      const config = await loadConfig('testagent');
      
      expect(config).toEqual(mockConfig);
    });

    test('returns default config when file does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      const config = await loadConfig('testagent');
      
      expect(config).toEqual({ relay: 'https://api.coneko.ai', lastPoll: null, discoverable: false });
    });
  });

  describe('saveConfig', () => {
    test('writes config to file', async () => {
      const config = { relay: 'https://test.relay.com', lastPoll: null, discoverable: false };
      
      await saveConfig('testagent', config);
      
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        config,
        { spaces: 2 }
      );
    });
  });

  describe('listAgents', () => {
    test('returns list of agent directories', async () => {
      (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
      (fs.readdir as unknown as jest.Mock).mockResolvedValue([
        { name: 'agent1', isDirectory: () => true },
        { name: 'agent2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ]);
      
      const agents = await listAgents();
      
      expect(agents).toEqual(['agent1', 'agent2']);
    });

    test('returns empty array when base dir does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      
      const agents = await listAgents();
      
      expect(agents).toEqual([]);
    });
  });
});
