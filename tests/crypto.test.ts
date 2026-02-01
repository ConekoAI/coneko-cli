/**
 * Crypto Module Tests
 * Tests Ed25519/X25519 cryptographic operations
 */

import {
  generateKeyPair,
  getFingerprint,
  signMessage,
  verifySignature,
  encryptMessage,
  decryptMessage
} from '../src/lib/crypto';

describe('Crypto Module', () => {
  describe('generateKeyPair', () => {
    test('generates valid key pair with all required fields', () => {
      const keys = generateKeyPair();
      
      expect(keys).toHaveProperty('signingPrivate');
      expect(keys).toHaveProperty('signingPublic');
      expect(keys).toHaveProperty('encryptionPrivate');
      expect(keys).toHaveProperty('encryptionPublic');
      
      // All keys should be base64 strings
      expect(Buffer.from(keys.signingPrivate, 'base64').length).toBe(32);
      expect(Buffer.from(keys.signingPublic, 'base64').length).toBe(32);
      expect(Buffer.from(keys.encryptionPrivate, 'base64').length).toBe(32);
      expect(Buffer.from(keys.encryptionPublic, 'base64').length).toBe(32);
    });

    test('generates unique key pairs each time', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();
      
      expect(keys1.signingPrivate).not.toBe(keys2.signingPrivate);
      expect(keys1.signingPublic).not.toBe(keys2.signingPublic);
    });
  });

  describe('getFingerprint', () => {
    test('generates consistent fingerprint from public key', () => {
      const publicKey = 'base64publickeydata';
      const fp1 = getFingerprint(publicKey);
      const fp2 = getFingerprint(publicKey);
      
      expect(fp1).toBe(fp2);
      expect(typeof fp1).toBe('string');
      expect(fp1.length).toBeGreaterThan(0);
    });

    test('generates different fingerprints for different keys', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();
      
      const fp1 = getFingerprint(keys1.encryptionPublic);
      const fp2 = getFingerprint(keys2.encryptionPublic);
      
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('signMessage and verifySignature', () => {
    test('signs and verifies message successfully', () => {
      const keys = generateKeyPair();
      const message = { hello: 'world', timestamp: Date.now() };
      
      const signature = signMessage(message, keys.signingPrivate);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      
      const isValid = verifySignature(message, signature, keys.signingPublic);
      expect(isValid).toBe(true);
    });

    test('rejects signature with wrong public key', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();
      const message = { test: 'data' };
      
      const signature = signMessage(message, keys1.signingPrivate);
      const isValid = verifySignature(message, signature, keys2.signingPublic);
      
      expect(isValid).toBe(false);
    });

    test('rejects tampered message', () => {
      const keys = generateKeyPair();
      const message = { hello: 'world' };
      const signature = signMessage(message, keys.signingPrivate);
      
      const tamperedMessage = { hello: 'tampered' };
      const isValid = verifySignature(tamperedMessage, signature, keys.signingPublic);
      
      expect(isValid).toBe(false);
    });

    test('handles canonical JSON ordering', () => {
      const keys = generateKeyPair();
      const message1 = { a: 1, b: 2, c: 3 };
      const message2 = { c: 3, a: 1, b: 2 };
      
      const signature = signMessage(message1, keys.signingPrivate);
      const isValid = verifySignature(message2, signature, keys.signingPublic);
      
      expect(isValid).toBe(true);
    });
  });

  describe('encryptMessage and decryptMessage', () => {
    test('encrypts and decrypts message successfully', () => {
      const keys = generateKeyPair();
      const plaintext = 'Hello, secret world!';
      
      const encrypted = encryptMessage(plaintext, keys.encryptionPublic);
      expect(encrypted).toHaveProperty('ephemeralPublic');
      expect(encrypted).toHaveProperty('ciphertext');
      
      const decrypted = decryptMessage(encrypted, keys.encryptionPrivate);
      expect(decrypted).toBe(plaintext);
    });

    test('produces different ciphertexts for same plaintext', () => {
      const keys = generateKeyPair();
      const plaintext = 'Same message';
      
      const encrypted1 = encryptMessage(plaintext, keys.encryptionPublic);
      const encrypted2 = encryptMessage(plaintext, keys.encryptionPublic);
      
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.ephemeralPublic).not.toBe(encrypted2.ephemeralPublic);
      
      // Both should decrypt to same plaintext
      expect(decryptMessage(encrypted1, keys.encryptionPrivate)).toBe(plaintext);
      expect(decryptMessage(encrypted2, keys.encryptionPrivate)).toBe(plaintext);
    });

    test('handles empty string', () => {
      const keys = generateKeyPair();
      const plaintext = '';
      
      const encrypted = encryptMessage(plaintext, keys.encryptionPublic);
      const decrypted = decryptMessage(encrypted, keys.encryptionPrivate);
      
      expect(decrypted).toBe(plaintext);
    });

    test('handles unicode characters', () => {
      const keys = generateKeyPair();
      const plaintext = 'Hello 世界 🌍 émojis!';
      
      const encrypted = encryptMessage(plaintext, keys.encryptionPublic);
      const decrypted = decryptMessage(encrypted, keys.encryptionPrivate);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});
