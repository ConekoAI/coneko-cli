module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.test.ts'],
  setupFilesAfterEnv: ['./tests/e2e/setup.ts'],
  testTimeout: 60000, // 60s for E2E tests
  collectCoverage: false, // Don't collect coverage for E2E
  verbose: true,
};
