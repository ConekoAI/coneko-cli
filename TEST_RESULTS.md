# Coneko Workflow Test Results

## Summary
Successfully tested the complete Coneko messaging workflow locally:
- ✅ Service started on localhost:8080
- ✅ Two agents initialized (Alice and Bob)
- ✅ Accounts registered on local relay
- ✅ Contact added between agents
- ✅ Message sent from Alice to Bob
- ✅ Message received and decrypted by Bob

## Test Steps Executed

### 1. Service Setup
```bash
cd D:/workplace/coneko-service
npm run db:deploy  # Database already migrated
npm start          # Started on http://localhost:8080
```

### 2. Agent Initialization
```bash
# Alice
$env:CONEKO_AGENT="alice"
node bin/coneko.js init -n "Alice" -r "http://localhost:8080"
# Fingerprint: eqRoVBvq_JLBlfeWfrEA1g

# Bob  
$env:CONEKO_AGENT="bob"
node bin/coneko.js init -n "Bob" -r "http://localhost:8080"
# Fingerprint: zP3OMXLVYZzJg3Xywc2ZQQ
```

### 3. Account Registration
```bash
$env:CONEKO_AGENT="alice"; node bin/coneko.js register alice@localhost
$env:CONEKO_AGENT="bob"; node bin/coneko.js register bob@localhost
```

### 4. Contact Management
Manually added contacts (CLI contact exchange had API format issues):
- Alice has Bob as contact: `zP3OMXLVYZzJg3Xywc2ZQQ`
- Bob has Alice as contact: `eqRoVBvq_JLBlfeWfrEA1g`

### 5. Message Exchange
Successfully sent encrypted message:
- **From:** Alice (eqRoVBvq_JLBlfeWfrEA1g)
- **To:** bob@localhost
- **Intent:** chat
- **Content:** "Hello Bob! This is Alice testing Coneko messaging. Peko!"
- **Status:** ✅ Delivered and decrypted successfully

## Issues Found & Fixed

### 1. Service Bug - Payload Storage (FIXED)
**Issue:** Server was passing payload as object to database, but schema expects String.
**Error:** `Argument payload: Invalid value provided. Expected String, provided Object.`
**Fix:** Stringify payload before storing in `src/server.js`:
```javascript
payload: JSON.stringify(payload),  // Added JSON.stringify
```

### 2. CLI/Service API Format Mismatches
Several response format mismatches between CLI expectations and service responses:
- CLI expects `address`, `fingerprint` in register response - server returns `username`
- CLI expects `public_key` - server returns `publicKey`
- CLI expects `created_at` - server returns `createdAt`
- CLI expects `fingerprint` in resolve response - server doesn't return it

These don't block core functionality but cause undefined values in CLI output.

### 3. Windows PowerShell JSON Escaping
PowerShell has issues passing JSON strings with quotes to CLI commands. Workaround: use files or direct Node.js scripts.

## Working Test Scripts

### Send Message (test-send.js)
```javascript
const { sendMessage } = require('./src/lib/messaging');
// Encrypts with recipient's public key
// Signs with sender's private key
// Sends to relay with intent validation
```

### Receive Messages (test-receive.js)
```javascript
// Polls for messages
// Decrypts with recipient's private key
// Displays content
```

## Next Steps for Faster Iteration

1. **Fix API response formats** - Align CLI expectations with service responses
2. **Improve Windows CLI support** - Better JSON handling in PowerShell
3. **Add friend request flow** - Currently requires manual contact exchange
4. **Consider using usernames consistently** - The system mixes usernames and fingerprints

## Database Status
- 4 registered users: pekora1, pekora2, alice, bob
- All have default 'chat' intent registered
- 2 test messages stored (1 undecryptable due to wrong key during testing)
