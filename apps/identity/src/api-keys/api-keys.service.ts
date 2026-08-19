import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '@scheduler-platform/database';
import { ApiKeyService as AuthApiKeyService } from '@scheduler-platform/auth';
import { CreateApiKeyDto, ValidateApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    private readonly authApiKeyService: AuthApiKeyService,
  ) {}

  async createApiKey(tenantId: string, dto: CreateApiKeyDto) {
    const generated = this.authApiKeyService.generateApiKey(dto.prefix || 'pts_live');

    const entity = this.apiKeyRepo.create({
      tenantId,
      name: dto.name,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
      permissions: dto.permissions || [],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
    });

    const saved = await this.apiKeyRepo.save(entity);

    return {
      id: saved.id,
      name: saved.name,
      prefix: saved.prefix,
      permissions: saved.permissions,
      expiresAt: saved.expiresAt,
      rawKey: generated.rawKey, // Returned once upon creation
    };
  }

  async listApiKeys(tenantId: string) {
    return this.apiKeyRepo.find({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(tenantId: string, id: string) {
    const key = await this.apiKeyRepo.findOne({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API Key not found');

    key.isActive = false;
    await this.apiKeyRepo.save(key);
    return { success: true, message: 'API key revoked successfully' };
  }

  async validateApiKey(dto: ValidateApiKeyDto) {
    const keyHash = this.authApiKeyService.hashApiKey(dto.rawKey);
    const key = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
    });

    if (!key) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key has expired');
    }

    // Update last used timestamp
    key.lastUsedAt = new Date();
    await this.apiKeyRepo.save(key);

    return {
      valid: true,
      id: key.id,
      tenantId: key.tenantId,
      name: key.name,
      permissions: key.permissions,
    };
  }
}
