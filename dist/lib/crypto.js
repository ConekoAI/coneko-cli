"use strict";
/**
 * Cryptographic utilities for coneko-cli
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyPair = generateKeyPair;
exports.getFingerprint = getFingerprint;
exports.signMessage = signMessage;
exports.verifySignature = verifySignature;
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
const ed25519_1 = require("@noble/curves/ed25519");
const sha256_1 = require("@noble/hashes/sha256");
/**
 * Generate a new key pair for signing and encryption
 */
function generateKeyPair() {
    // Ed25519 for signing
    const signingPrivate = ed25519_1.ed25519.utils.randomPrivateKey();
    const signingPublic = ed25519_1.ed25519.getPublicKey(signingPrivate);
    // X25519 for encryption
    const encryptionPrivate = ed25519_1.x25519.utils.randomPrivateKey();
    const encryptionPublic = ed25519_1.x25519.getPublicKey(encryptionPrivate);
    return {
        signingPrivate: Buffer.from(signingPrivate).toString('base64'),
        signingPublic: Buffer.from(signingPublic).toString('base64'),
        encryptionPrivate: Buffer.from(encryptionPrivate).toString('base64'),
        encryptionPublic: Buffer.from(encryptionPublic).toString('base64')
    };
}
/**
 * Get fingerprint from public key
 */
function getFingerprint(publicKeyB64) {
    const keyBytes = Buffer.from(publicKeyB64, 'base64');
    const hash = (0, sha256_1.sha256)(keyBytes);
    return Buffer.from(hash.slice(0, 16)).toString('base64url').replace(/=+$/, '');
}
/**
 * Sign a message with Ed25519
 */
function signMessage(message, signingPrivateB64) {
    const privateKey = Buffer.from(signingPrivateB64, 'base64');
    const canonical = JSON.stringify(message, Object.keys(message).sort());
    const signature = ed25519_1.ed25519.sign(Buffer.from(canonical), privateKey);
    return Buffer.from(signature).toString('base64');
}
/**
 * Verify a message signature
 */
function verifySignature(message, signatureB64, publicKeyB64) {
    try {
        const publicKey = Buffer.from(publicKeyB64, 'base64');
        const signature = Buffer.from(signatureB64, 'base64');
        const canonical = JSON.stringify(message, Object.keys(message).sort());
        return ed25519_1.ed25519.verify(signature, Buffer.from(canonical), publicKey);
    }
    catch {
        return false;
    }
}
/**
 * Encrypt a message using X25519 ECDH
 */
function encryptMessage(plaintext, recipientPublicB64) {
    const ephemeralPrivate = ed25519_1.x25519.utils.randomPrivateKey();
    const ephemeralPublic = ed25519_1.x25519.getPublicKey(ephemeralPrivate);
    const recipientPublic = Buffer.from(recipientPublicB64, 'base64');
    // ECDH
    const sharedKey = ed25519_1.x25519.getSharedSecret(ephemeralPrivate, recipientPublic);
    // Simple XOR encryption (in production use AES-GCM)
    const plaintextBytes = Buffer.from(plaintext);
    const keystream = Buffer.alloc(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
        keystream[i] = sharedKey[i % sharedKey.length];
    }
    const ciphertext = Buffer.alloc(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
        ciphertext[i] = plaintextBytes[i] ^ keystream[i];
    }
    return {
        ephemeralPublic: Buffer.from(ephemeralPublic).toString('base64'),
        ciphertext: ciphertext.toString('base64')
    };
}
/**
 * Decrypt a message using X25519 ECDH
 */
function decryptMessage(encrypted, recipientPrivateB64) {
    const ephemeralPublic = Buffer.from(encrypted.ephemeralPublic, 'base64');
    const recipientPrivate = Buffer.from(recipientPrivateB64, 'base64');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    // ECDH
    const sharedKey = ed25519_1.x25519.getSharedSecret(recipientPrivate, ephemeralPublic);
    // XOR decryption
    const keystream = Buffer.alloc(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
        keystream[i] = sharedKey[i % sharedKey.length];
    }
    const plaintext = Buffer.alloc(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
        plaintext[i] = ciphertext[i] ^ keystream[i];
    }
    return plaintext.toString();
}
//# sourceMappingURL=crypto.js.map