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
} from '@scheduler-platform/database';
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
    const roles = await this.roleRepo.find({ where: whereConditions });
    if (!roles.length) return [];

    const roleIds = roles.map((r) => r.id);
    const rolePerms = await this.rolePermRepo.findBy({ roleId: In(roleIds) });

    const permIds = [...new Set(rolePerms.map((rp) => rp.permissionId))];
    const permissions = permIds.length ? await this.permRepo.findBy({ id: In(permIds) }) : [];
    const permMap = new Map(permissions.map((p) => [p.id, p.action]));

    const rolePermMap = new Map<string, string[]>();
    for (const rp of rolePerms) {
      const action = permMap.get(rp.permissionId);
      if (action) {
        if (!rolePermMap.has(rp.roleId)) {
          rolePermMap.set(rp.roleId, []);
        }
        rolePermMap.get(rp.roleId)!.push(action);
      }
    }

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      tenantId: role.tenantId,
      permissions: rolePermMap.get(role.id) || [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
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

    const resolvedPermissions: string[] = [];

    if (dto.permissions && dto.permissions.length > 0) {
      const isUuid = (str: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      const uuidPerms = dto.permissions.filter((p) => isUuid(p));
      const actionPerms = dto.permissions.filter((p) => !isUuid(p));

      // 1. Batch fetch existing permissions
      const [existingByUuid, existingByAction] = await Promise.all([
        uuidPerms.length ? this.permRepo.findBy({ id: In(uuidPerms) }) : [],
        actionPerms.length ? this.permRepo.findBy({ action: In(actionPerms) }) : [],
      ]);

      const foundActionSet = new Set(existingByAction.map((p) => p.action));
      const missingActions = actionPerms.filter((a) => !foundActionSet.has(a));

      // 2. Batch insert any missing permissions
      let createdPerms: PermissionEntity[] = [];
      if (missingActions.length > 0) {
        const newPermEntities = missingActions.map((action) => {
          const [resource] = action.split(':');
          return this.permRepo.create({
            action,
            resource: resource || 'general',
            description: `Permission for ${action}`,
          });
        });
        createdPerms = await this.permRepo.save(newPermEntities);
      }

      // 3. Collect all resolved permissions
      const allPerms = [...existingByUuid, ...existingByAction, ...createdPerms];
      for (const p of allPerms) {
        resolvedPermissions.push(p.action);
      }

      // 4. Batch insert role-permission relations in 1 query
      if (allPerms.length > 0) {
        const rolePerms = allPerms.map((perm) =>
          this.rolePermRepo.create({
            roleId: role.id,
            permissionId: perm.id,
          }),
        );
        await this.rolePermRepo.save(rolePerms);
      }
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      tenantId: role.tenantId,
      permissions: resolvedPermissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async listUsers(tenantId: string) {
    const users = await this.userRepo.find({ where: { tenantId } });
    if (!users.length) return [];

    const userIds = users.map((u) => u.id);
    const userRoles = await this.userRoleRepo.findBy({ userId: In(userIds) });

    const roleIds = [...new Set(userRoles.map((ur) => ur.roleId))];
    const roles = roleIds.length ? await this.roleRepo.findBy({ id: In(roleIds) }) : [];
    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    const userRoleMap = new Map<string, string[]>();
    for (const ur of userRoles) {
      const roleName = roleMap.get(ur.roleId);
      if (roleName) {
        if (!userRoleMap.has(ur.userId)) {
          userRoleMap.set(ur.userId, []);
        }
        userRoleMap.get(ur.userId)!.push(roleName);
      }
    }

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      tenantId: u.tenantId,
      status: u.status,
      roles: userRoleMap.get(u.id) || [],
      createdAt: u.createdAt,
    }));
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
