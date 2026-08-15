import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, AssignRoleDto, CreateUserDto } from './dto/rbac.dto';
import { CurrentTenant, Roles, AuthGuard, RbacGuard } from '@scheduler-platform/auth';

@ApiTags('rbac')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List all available roles for the tenant' })
  async listRoles(@CurrentTenant() tenantId: string) {
    return this.rbacService.listRoles(tenantId);
  }

  @Post('roles')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a custom role' })
  async createRole(@CurrentTenant() tenantId: string, @Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(tenantId, dto);
  }

  @Get('users')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List all organization users' })
  async listUsers(@CurrentTenant() tenantId: string) {
    return this.rbacService.listUsers(tenantId);
  }

  @Post('users')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create or invite a new user' })
  async createUser(@CurrentTenant() tenantId: string, @Body() dto: CreateUserDto) {
    return this.rbacService.createUser(tenantId, dto);
  }

  @Post('users/:id/roles')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Assign a role to an organization user' })
  async assignRole(
    @CurrentTenant() tenantId: string,
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rbacService.assignRole(tenantId, userId, dto);
  }
}
