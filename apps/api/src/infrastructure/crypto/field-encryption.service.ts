import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env['ENCRYPTION_KEY'] ?? '';
    if (!hexKey || hexKey.length !== 64) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('ENCRYPTION_KEY is required in production');
      }
      new Logger(FieldEncryptionService.name).warn('ENCRYPTION_KEY not set, using dev fallback');
      const fallback = 'dev-encryption-key-change-in-prod00'.padEnd(32, '0');
      this.key = Buffer.from(fallback.substring(0, 32), 'utf8');
      return;
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
