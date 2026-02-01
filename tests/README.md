# Testing Guide

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- crypto.test.js

# Run with coverage report
npm test -- --coverage
```

## Test Structure

- **`setup.js`** - Global mocks and test utilities
- **`crypto.test.js`** - Cryptographic operations (14 tests)
- **`config.test.js`** - Configuration management (13 tests)
- **`identity.test.js`** - Agent identity commands (6 tests)
- **`registry.test.js`** - DNS-style addressing (9 tests)
- **`intents.test.js`** - Intent registration/management (12 tests)
- **`permissions.test.js`** - Permission system (10 tests)
- **`contacts.test.js`** - Contact management (9 tests)
- **`messages.test.js`** - Message sending with intents (8 tests)
- **`mail.test.js`** - Message polling/retrieval (9 tests)
- **`settings.test.js`** - Discoverability settings (8 tests)
- **`gateway.test.js`** - OpenClaw gateway setup (8 tests)

## Total Coverage: 116 Tests

### Core Libraries (27 tests)
- **Crypto** - Ed25519/X25519 key generation, signing/verification, encryption/decryption
- **Config** - Agent directory management, config file operations

### Commands (89 tests)
- **Identity** - Agent initialization, identity display
- **Registry** - Address registration, resolution, reverse lookup
- **Intents** - Intent registration, listing, removal, querying
- **Permissions** - Grant/revoke permissions, list granted/received
- **Contacts** - Contact search, add, list, remove
- **Messages** - Send with intent validation, encryption
- **Mail** - Poll messages, decrypt, acknowledge
- **Settings** - Discoverability toggles, account search
- **Gateway** - OpenClaw integration setup

## Mocks

All external dependencies are mocked:
- `fs-extra` - File system operations
- `axios` - HTTP requests
- `ora` - CLI spinners
- `chalk` - Terminal colors

## Adding New Tests

```javascript
const myModule = require('../src/commands/my-module');

describe('My Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does something', async () => {
    // Arrange
    mockDependency.mockResolvedValue({ data: 'value' });
    
    // Act
    const result = await myModule.function(args);
    
    // Assert
    expect(result).toBe(expected);
    expect(mockDependency).toHaveBeenCalledWith(expectedArgs);
  });
});
```
