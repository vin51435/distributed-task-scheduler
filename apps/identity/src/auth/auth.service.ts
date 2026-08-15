import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  UserEntity,
  TenantEntity,
  TenantLimitsEntity,
  RoleEntity,
  UserRoleEntity,
  RolePermissionEntity,
  RefreshTokenEntity,
  UserStatus,
  TenantStatus,
  TenantPlan,
} from '@scheduler/database';
import { JwtService, PasswordService } from '@scheduler-platform/auth';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(TenantLimitsEntity)
    private readonly limitsRepo: Repository<TenantLimitsEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Registers a new tenant and default owner user.
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existingUser) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const slug = dto.slug || dto.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const existingTenant = await this.tenantRepo.findOne({ where: { slug } });
    if (existingTenant) {
      throw new ConflictException(`Tenant with slug '${slug}' already exists`);
    }

    // 1. Create Tenant
    const tenant = this.tenantRepo.create({
      name: dto.organizationName,
      slug,
      plan: TenantPlan.FREE,
      status: TenantStatus.ACTIVE,
    });
    const savedTenant = await this.tenantRepo.save(tenant);

    // 2. Create Default Limits
    const limits = this.limitsRepo.create({
      tenantId: savedTenant.id,
      maxSchedules: 50,
      maxJobs: 1000,
      maxWorkers: 10,
      maxRequestsPerMinute: 300,
    });
    await this.limitsRepo.save(limits);

    // 3. Create Default Roles (OWNER, ADMIN, OPERATOR, VIEWER)
    const ownerRole = await this.roleRepo.save(
      this.roleRepo.create({
        tenantId: savedTenant.id,
        name: 'OWNER',
        description: 'Full administrative ownership of the organization',
      }),
    );

    await this.roleRepo.save([
      this.roleRepo.create({
        tenantId: savedTenant.id,
        name: 'ADMIN',
        description: 'Administrator with full operational access',
      }),
      this.roleRepo.create({
        tenantId: savedTenant.id,
        name: 'OPERATOR',
        description: 'Operator can trigger, pause, and retry jobs',
      }),
      this.roleRepo.create({
        tenantId: savedTenant.id,
        name: 'VIEWER',
        description: 'Read-only access to schedules and executions',
      }),
    ]);

    // 4. Create Owner User
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = this.userRepo.create({
      tenantId: savedTenant.id,
      email: dto.email.toLowerCase(),
      passwordHash,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
    });
    const savedUser = await this.userRepo.save(user);

    // 5. Assign OWNER role
    await this.userRoleRepo.save(
      this.userRoleRepo.create({
        userId: savedUser.id,
        roleId: ownerRole.id,
        tenantId: savedTenant.id,
      }),
    );

    // 6. Issue Tokens
    const tokenPair = this.jwtService.signTokenPair({
      sub: savedUser.id,
      email: savedUser.email,
      tenantId: savedTenant.id,
      roles: ['OWNER'],
      permissions: ['*'],
    });

    await this.storeRefreshToken(savedUser.id, tokenPair.refreshToken);

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        tenantId: savedTenant.id,
        roles: ['OWNER'],
      },
      tenant: {
        id: savedTenant.id,
        name: savedTenant.name,
        slug: savedTenant.slug,
        plan: savedTenant.plan,
      },
      tokens: tokenPair,
    };
  }

  /**
   * Logs in an existing user.
   */
  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    const isMatch = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);

    const tokenPair = this.jwtService.signTokenPair({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions,
    });

    await this.storeRefreshToken(user.id, tokenPair.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles,
        permissions,
      },
      tokens: tokenPair,
    };
  }

  /**
   * Refreshes access token with valid refresh token.
   */
  async refresh(dto: RefreshTokenDto) {
    let payload;
    try {
      payload = this.jwtService.verify(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Provided token is not a refresh token');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is revoked or expired');
    }

    // Revoke old refresh token for rotation
    stored.revoked = true;
    await this.refreshTokenRepo.save(stored);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account no longer active');
    }

    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);

    const newTokens = this.jwtService.signTokenPair({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions,
    });

    await this.storeRefreshToken(user.id, newTokens.refreshToken);

    return newTokens;
  }

  /**
   * Revokes refresh token on logout.
   */
  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.refreshTokenRepo.update({ tokenHash }, { revoked: true });
    return { success: true };
  }

  /**
   * Changes user password.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await this.passwordService.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password incorrect');
    }

    user.passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.userRepo.save(user);

    // Revoke all existing refresh tokens
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });

    return { message: 'Password updated successfully' };
  }

  /**
   * Fetches user profile with roles and permissions.
   */
  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tenant = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    const roles = await this.getUserRoles(userId);
    const permissions = await this.getUserPermissions(userId);

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: tenant?.name,
      roles,
      permissions,
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash,
        expiresAt,
        revoked: false,
      }),
    );
  }

  public async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({ where: { userId } });
    if (!userRoles.length) return [];

    const roleIds = userRoles.map((ur) => ur.roleId);
    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    return roles.map((r: RoleEntity) => r.name);
  }

  public async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({ where: { userId } });
    if (!userRoles.length) return [];

    const roleIds = userRoles.map((ur) => ur.roleId);
    const rolePerms = await this.rolePermRepo.find({
      where: roleIds.map((roleId) => ({ roleId })),
    });

    return rolePerms.map((rp) => rp.permissionId);
  }
}
