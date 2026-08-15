import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity, TenantLimitsEntity } from '@scheduler/database';
import { UpdateTenantDto, UpdateTenantLimitsDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(TenantLimitsEntity)
    private readonly limitsRepo: Repository<TenantLimitsEntity>,
  ) {}

  async getTenant(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limits = await this.limitsRepo.findOne({ where: { tenantId } });
    return {
      tenant,
      limits: limits || {
        maxSchedules: 50,
        maxJobs: 1000,
        maxWorkers: 10,
        maxRequestsPerMinute: 300,
      },
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  async getLimits(tenantId: string) {
    const limits = await this.limitsRepo.findOne({ where: { tenantId } });
    if (!limits) throw new NotFoundException('Tenant not found');
    return limits;
  }

  async updateLimits(tenantId: string, dto: UpdateTenantLimitsDto) {
    let limits = await this.limitsRepo.findOne({ where: { tenantId } });
    if (!limits) {
      limits = this.limitsRepo.create({ tenantId, ...dto });
    } else {
      Object.assign(limits, dto);
    }
    limits.updatedAt = new Date();
    return this.limitsRepo.save(limits);
  }
}
