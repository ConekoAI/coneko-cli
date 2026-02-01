/**
 * Test Setup - Mocks and Utilities
 */

const path = require('path');
const os = require('os');

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(),
  pathExists: jest.fn().mockResolvedValue(false),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(),
  copy: jest.fn().mockResolvedValue(),
  readdir: jest.fn().mockResolvedValue([]),
  writeFile: jest.fn().mockResolvedValue(),
  readFile: jest.fn().mockResolvedValue('')
}));

// Mock ora
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    text: ''
  }));
});

// Mock chalk
jest.mock('chalk', () => ({
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  red: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  bold: jest.fn((text) => text),
  blue: jest.fn((text) => text)
}));

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} })
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Test utilities
const TEST_AGENT_DIR = path.join(os.tmpdir(), 'coneko-test');

module.exports = { TEST_AGENT_DIR };
