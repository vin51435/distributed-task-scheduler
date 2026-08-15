import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  keyHash: string;
}

@Injectable()
export class ApiKeyService {
  private readonly defaultPrefix = 'pts_live';

  /**
   * Generates a new API Key with a prefix, entropy secret, and SHA-256 hash.
   * Format: `<prefix>_<entropy>` e.g. `pts_live_9f8c12...`
   */
  public generateApiKey(prefix = this.defaultPrefix): GeneratedApiKey {
    const entropy = crypto.randomBytes(24).toString('hex');
    const rawKey = `${prefix}_${entropy}`;
    const keyHash = this.hashApiKey(rawKey);

    return {
      rawKey,
      prefix,
      keyHash,
    };
  }

  /**
   * Hashes raw API key with SHA-256 for secure storage in database.
   */
  public hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Validates if a raw API key matches the stored hash in constant time.
   */
  public validateApiKey(rawKey: string, storedHash: string): boolean {
    if (!rawKey || !storedHash) return false;
    const computedHash = this.hashApiKey(rawKey);
    const compBuf = Buffer.from(computedHash);
    const storedBuf = Buffer.from(storedHash);

    return compBuf.length === storedBuf.length && crypto.timingSafeEqual(compBuf, storedBuf);
  }

  /**
   * Extracts prefix from raw key.
   */
  public extractPrefix(rawKey: string): string {
    if (!rawKey) return '';
    const parts = rawKey.split('_');
    if (parts.length >= 2) {
      return `${parts[0]}_${parts[1]}`;
    }
    return '';
  }
}
