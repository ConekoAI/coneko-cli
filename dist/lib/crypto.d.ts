/**
 * Cryptographic utilities for coneko-cli
 */
import { AgentKeys, EncryptedPayload, MessageContent } from '../types';
/**
 * Generate a new key pair for signing and encryption
 */
export declare function generateKeyPair(): AgentKeys;
/**
 * Get fingerprint from public key
 */
export declare function getFingerprint(publicKeyB64: string): string;
/**
 * Sign a message with Ed25519
 */
export declare function signMessage(message: MessageContent, signingPrivateB64: string): string;
/**
 * Verify a message signature
 */
export declare function verifySignature(message: MessageContent, signatureB64: string, publicKeyB64: string): boolean;
/**
 * Encrypt a message using X25519 ECDH
 */
export declare function encryptMessage(plaintext: string, recipientPublicB64: string): EncryptedPayload;
/**
 * Decrypt a message using X25519 ECDH
 */
export declare function decryptMessage(encrypted: EncryptedPayload, recipientPrivateB64: string): string;
//# sourceMappingURL=crypto.d.ts.map