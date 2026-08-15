import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  private readonly keyLength = 64;

  /**
   * Hashes a plaintext password using scrypt with a cryptographically secure random salt.
   * Format: `scrypt$salt$derivedKey`
   */
  public async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Synchronous password hash.
   */
  public hashSync(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, this.keyLength);
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  /**
   * Compares plaintext password against stored hash with timing-safe comparison.
   */
  public async compare(password: string, storedHash: string): Promise<boolean> {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
      }

      const [, salt, expectedHex] = parts;
      const expectedKey = Buffer.from(expectedHex, 'hex');

      return new Promise((resolve) => {
        crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
          if (err) return resolve(false);
          resolve(
            derivedKey.length === expectedKey.length &&
              crypto.timingSafeEqual(derivedKey, expectedKey),
          );
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Synchronous comparison.
   */
  public compareSync(password: string, storedHash: string): boolean {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
      }

      const [, salt, expectedHex] = parts;
      const expectedKey = Buffer.from(expectedHex, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, this.keyLength);

      return (
        derivedKey.length === expectedKey.length && crypto.timingSafeEqual(derivedKey, expectedKey)
      );
    } catch {
      return false;
    }
  }
}
