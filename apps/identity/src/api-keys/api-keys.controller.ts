import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, ValidateApiKeyDto } from './dto/api-key.dto';
import { CurrentTenant, Roles, Public, AuthGuard, RbacGuard } from '@scheduler-platform/auth';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Generate a new scoped API Key for tenant' })
  async createApiKey(@CurrentTenant() tenantId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.createApiKey(tenantId, dto);
  }

  @Get()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List all active API Keys for tenant' })
  async listApiKeys(@CurrentTenant() tenantId: string) {
    return this.apiKeysService.listApiKeys(tenantId);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Revoke an API Key' })
  async revokeApiKey(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.apiKeysService.revokeApiKey(tenantId, id);
  }

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate raw API Key (internal endpoint for Gateway)' })
  async validateApiKey(@Body() dto: ValidateApiKeyDto) {
    return this.apiKeysService.validateApiKey(dto);
  }
}
