import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import { env } from '../config/env.js';

interface EncryptedSecret {
  value: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Retrieve and validate the master encryption key from env.
 * The key must be a 64-character hex string (32 bytes).
 */
function getMasterKey(): Buffer {
  const hexKey = env.SECRET_VAULT_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'SECRET_VAULT_KEY must be exactly 64 hex characters (32 bytes)',
    );
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the ciphertext, IV, and authentication tag as separate Buffers
 * for storage in the database.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96-bit nonce — optimal for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag(); // 128-bit tag

  return { value: encrypted, iv, authTag };
}

/**
 * Decrypt a secret stored in the database.
 * Throws if decryption fails (wrong key, tampered ciphertext, etc.).
 */
export function decryptSecret(
  value: Buffer,
  iv: Buffer,
  authTag: Buffer,
): string {
  const key = getMasterKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(value),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Re-encrypt a secret (useful for key rotation).
 */
export function rotateSecret(
  value: Buffer,
  iv: Buffer,
  authTag: Buffer,
): EncryptedSecret {
  const plaintext = decryptSecret(value, iv, authTag);
  return encryptSecret(plaintext);
}
