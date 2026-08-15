import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import {
  RoleEntity,
  PermissionEntity,
  RolePermissionEntity,
  UserEntity,
  UserRoleEntity,
  UserStatus,
} from '@scheduler/database';
import { CreateRoleDto, AssignRoleDto, CreateUserDto } from './dto/rbac.dto';
import { PasswordService } from '@scheduler-platform/auth';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    private readonly passwordService: PasswordService,
  ) {}

  async listRoles(tenantId: string) {
    const whereConditions = tenantId
      ? [{ tenantId }, { tenantId: IsNull() }]
      : [{ tenantId: IsNull() }];
    return this.roleRepo.find({
      where: whereConditions,
    });
  }

  async createRole(tenantId: string, dto: CreateRoleDto) {
    const existing = await this.roleRepo.findOne({
      where: { name: dto.name.toUpperCase(), tenantId },
    });
    if (existing) {
      throw new ConflictException(`Role '${dto.name}' already exists in tenant`);
    }

    const role = await this.roleRepo.save(
      this.roleRepo.create({
        tenantId,
        name: dto.name.toUpperCase(),
        description: dto.description,
      }),
    );

    if (dto.permissions && dto.permissions.length > 0) {
      const rolePerms = dto.permissions.map((permId) =>
        this.rolePermRepo.create({
          roleId: role.id,
          permissionId: permId,
        }),
      );
      await this.rolePermRepo.save(rolePerms);
    }

    return role;
  }

  async listUsers(tenantId: string) {
    const users = await this.userRepo.find({ where: { tenantId } });
    const results = [];

    for (const u of users) {
      const userRoles = await this.userRoleRepo.find({ where: { userId: u.id } });
      const roles = userRoles.length
        ? (await this.roleRepo.findBy({ id: In(userRoles.map((r) => r.roleId)) })).map(
            (r: RoleEntity) => r.name,
          )
        : [];

      results.push({
        id: u.id,
        email: u.email,
        tenantId: u.tenantId,
        status: u.status,
        roles,
        createdAt: u.createdAt,
      });
    }

    return results;
  }

  async createUser(tenantId: string, dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.userRepo.save(
      this.userRepo.create({
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      }),
    );

    const targetRoleName = dto.roleName ? dto.roleName.toUpperCase() : 'VIEWER';
    const roleWhere = tenantId
      ? [
          { name: targetRoleName, tenantId },
          { name: targetRoleName, tenantId: IsNull() },
        ]
      : [{ name: targetRoleName, tenantId: IsNull() }];
    const role = await this.roleRepo.findOne({
      where: roleWhere,
    });

    if (role) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({
          userId: user.id,
          roleId: role.id,
          tenantId,
        }),
      );
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: targetRoleName,
    };
  }

  async assignRole(tenantId: string, userId: string, dto: AssignRoleDto) {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found in this tenant');

    const roleWhere = tenantId
      ? [
          { id: dto.roleId, tenantId },
          { id: dto.roleId, tenantId: IsNull() },
        ]
      : [{ id: dto.roleId, tenantId: IsNull() }];
    const role = await this.roleRepo.findOne({
      where: roleWhere,
    });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.userRoleRepo.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) return existing;

    return this.userRoleRepo.save(
      this.userRoleRepo.create({
        userId,
        roleId: role.id,
        tenantId,
      }),
    );
  }
}
