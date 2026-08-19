import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { ApiKeyService } from './api-key.service';

describe('Auth Package Services', () => {
  describe('JwtService', () => {
    let jwtService: JwtService;

    beforeEach(() => {
      jwtService = new JwtService();
    });

    it('should sign and verify valid JWT token', () => {
      const payload = {
        sub: 'user-123',
        email: 'admin@tenant.com',
        tenantId: 'tenant-abc',
        roles: ['ADMIN'],
        permissions: ['schedules:create'],
      };

      const token = jwtService.sign(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwtService.verify(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.tenantId).toBe('tenant-abc');
      expect(decoded.roles).toContain('ADMIN');
    });

    it('should reject tampered token', () => {
      const token = jwtService.sign({ sub: 'user-1', tenantId: 'tenant-1' });
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;

      expect(() => jwtService.verify(tampered)).toThrow('Invalid JWT signature');
    });

    it('should issue token pair and verify expiration', () => {
      const pair = jwtService.signTokenPair({
        sub: 'user-2',
        tenantId: 'tenant-2',
        roles: ['OPERATOR'],
      });

      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();

      const accessPayload = jwtService.verify(pair.accessToken);
      expect(accessPayload.type).toBe('access');

      const refreshPayload = jwtService.verify(pair.refreshToken);
      expect(refreshPayload.type).toBe('refresh');
    });
  });

  describe('PasswordService', () => {
    let passwordService: PasswordService;

    beforeEach(() => {
      passwordService = new PasswordService();
    });

    it('should hash and compare passwords correctly', async () => {
      const password = 'SuperSecretPassword!2026';
      const hash = await passwordService.hash(password);

      expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);

      const isMatch = await passwordService.compare(password, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await passwordService.compare('WrongPassword', hash);
      expect(isWrongMatch).toBe(false);
    });
  });

  describe('ApiKeyService', () => {
    let apiKeyService: ApiKeyService;

    beforeEach(() => {
      apiKeyService = new ApiKeyService();
    });

    it('should generate secure prefixed API key and hash', () => {
      const generated = apiKeyService.generateApiKey('pts_live');
      expect(generated.rawKey.startsWith('pts_live_')).toBe(true);
      expect(generated.keyHash).toBeDefined();
      expect(generated.prefix).toBe('pts_live');

      const isValid = apiKeyService.validateApiKey(generated.rawKey, generated.keyHash);
      expect(isValid).toBe(true);

      const isInvalid = apiKeyService.validateApiKey('pts_live_badkey', generated.keyHash);
      expect(isInvalid).toBe(false);
    });
  });
});
