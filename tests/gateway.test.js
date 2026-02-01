/**
 * Gateway Command Tests
 * Tests OpenClaw gateway setup
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const gateway = require('../src/commands/gateway');
const { loadKeys, getAgentPaths } = require('../src/lib/config');

jest.mock('../src/lib/config', () => ({
  loadKeys: jest.fn(),
  getAgentPaths: jest.fn()
}));

describe('Gateway Commands', () => {
  const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');

  beforeEach(() => {
    jest.clearAllMocks();
    loadKeys.mockResolvedValue({
      name: 'Test Agent',
      agentDir: '/test/agent'
    });
    getAgentPaths.mockReturnValue({
      agentDir: '/test/agent'
    });
    fs.pathExists.mockResolvedValue(false);
    fs.readJson.mockResolvedValue({ agents: { list: [] } });
    fs.writeJson.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.ensureDir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
  });

  describe('setup', () => {
    test('fails when OpenClaw not installed', async () => {
      fs.pathExists.mockResolvedValue(false);

      await gateway.setup({ agent: 'test' });

      // Spinner fail is called
      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    test('creates coneko-gateway agent configuration', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'test' });

      expect(fs.copy).toHaveBeenCalled(); // Backup
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
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      fs.readJson.mockResolvedValue({
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
      fs.pathExists.mockImplementation((p) => {
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
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockRejectedValue(new Error('Permission denied'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await gateway.setup({ agent: 'test' });

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('uses specified agent when provided', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('.openclaw')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await gateway.setup({ agent: 'myagent' });

      expect(loadKeys).toHaveBeenCalledWith('myagent');
    });

    test('creates INBOXES.md reference file', async () => {
      fs.pathExists.mockImplementation((p) => {
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
