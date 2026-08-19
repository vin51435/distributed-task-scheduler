import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto, UpdateTenantLimitsDto } from './dto/tenant.dto';
import { CurrentTenant, Roles, AuthGuard, RbacGuard } from '@scheduler-platform/auth';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant details and quotas' })
  async getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  @Patch('current')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update organization name and metadata' })
  async updateCurrent(@CurrentTenant() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateTenant(tenantId, dto);
  }

  @Get(':id/limits')
  @ApiOperation({ summary: 'Get tenant limits and quotas' })
  async getLimits(@Param('id') tenantId: string) {
    return this.tenantsService.getLimits(tenantId);
  }

  @Patch(':id/limits')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update tenant quotas and limits' })
  async updateLimits(@Param('id') tenantId: string, @Body() dto: UpdateTenantLimitsDto) {
    return this.tenantsService.updateLimits(tenantId, dto);
  }
}
