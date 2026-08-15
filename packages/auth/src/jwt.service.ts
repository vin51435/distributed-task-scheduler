import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtPayload } from './types';

export interface JwtSignOptions {
  expiresInSeconds?: number;
  secret?: string;
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly defaultSecret: string;
  private readonly defaultAccessExpiry: number;
  private readonly defaultRefreshExpiry: number;

  constructor() {
    this.defaultSecret = process.env.JWT_SECRET || 'scheduler_platform_super_secret_jwt_key_2026';
    this.defaultAccessExpiry = parseInt(process.env.JWT_ACCESS_EXPIRY || '3600', 10); // 1 hour
    this.defaultRefreshExpiry = parseInt(process.env.JWT_REFRESH_EXPIRY || '604800', 10); // 7 days
  }

  private base64UrlEncode(input: string | Buffer): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buf.toString('base64url');
  }

  private base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf8');
  }

  /**
   * Signs a JWT payload using HS256 algorithm.
   */
  public sign(payload: JwtPayload, options?: JwtSignOptions): string {
    const secret = options?.secret || this.defaultSecret;
    const now = Math.floor(Date.now() / 1000);
    const expiry = options?.expiresInSeconds ?? this.defaultAccessExpiry;

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const fullPayload: JwtPayload = {
      ...payload,
      iat: payload.iat ?? now,
      exp: payload.exp ?? now + expiry,
      jti: payload.jti ?? crypto.randomUUID(),
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Generates a pair of access and refresh tokens.
   */
  public signTokenPair(payload: Omit<JwtPayload, 'type' | 'exp' | 'iat' | 'jti'>): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const accessToken = this.sign(
      { ...payload, type: 'access' },
      { expiresInSeconds: this.defaultAccessExpiry },
    );

    const refreshToken = this.sign(
      { sub: payload.sub, tenantId: payload.tenantId, type: 'refresh' },
      { expiresInSeconds: this.defaultRefreshExpiry },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.defaultAccessExpiry,
    };
  }

  /**
   * Verifies and decodes a JWT token.
   */
  public verify(token: string, secret?: string): JwtPayload {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT token must have 3 components');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const key = secret || this.defaultSecret;

    const expectedSignature = crypto
      .createHmac('sha256', key)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      throw new Error('Invalid JWT signature');
    }

    const payload: JwtPayload = JSON.parse(this.base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error('JWT token has expired');
    }

    return payload;
  }

  /**
   * Decodes a JWT token without verifying the signature (useful for inspection/logging).
   */
  public decode(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(this.base64UrlDecode(parts[1]));
    } catch {
      return null;
    }
  }
}
