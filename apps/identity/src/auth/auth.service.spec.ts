import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import {
  UserEntity,
  TenantEntity,
  TenantLimitsEntity,
  RoleEntity,
  UserRoleEntity,
  RolePermissionEntity,
  RefreshTokenEntity,
} from '@scheduler/database';
import { JwtService, PasswordService } from '@scheduler-platform/auth';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let tenantRepo: any;
  let limitsRepo: any;
  let roleRepo: any;
  let userRoleRepo: any;
  let rolePermRepo: any;
  let refreshTokenRepo: any;
  let jwtService: JwtService;
  let passwordService: PasswordService;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'user-1', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'user-1', ...entity })),
    };
    tenantRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'tenant-1', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'tenant-1', ...entity })),
    };
    limitsRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    roleRepo = {
      create: jest.fn((dto) => ({ id: 'role-1', ...dto })),
      save: jest.fn((entity) =>
        Array.isArray(entity)
          ? Promise.resolve(entity.map((e, idx) => ({ id: `role-${idx + 1}`, ...e })))
          : Promise.resolve({ id: 'role-1', ...entity }),
      ),
      findBy: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'OWNER' }]),
    };
    userRoleRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([{ userId: 'user-1', roleId: 'role-1' }]),
    };
    rolePermRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    refreshTokenRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    jwtService = new JwtService();
    passwordService = new PasswordService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(TenantEntity), useValue: tenantRepo },
        { provide: getRepositoryToken(TenantLimitsEntity), useValue: limitsRepo },
        { provide: getRepositoryToken(RoleEntity), useValue: roleRepo },
        { provide: getRepositoryToken(UserRoleEntity), useValue: userRoleRepo },
        { provide: getRepositoryToken(RolePermissionEntity), useValue: rolePermRepo },
        { provide: getRepositoryToken(RefreshTokenEntity), useValue: refreshTokenRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register tenant and owner user and issue tokens', async () => {
    const result = await service.register({
      organizationName: 'Beta Corp',
      email: 'owner@betacorp.com',
      password: 'StrongPassword123!',
    });

    expect(result.user).toBeDefined();
    expect(result.tenant).toBeDefined();
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(tenantRepo.save).toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('should login valid user successfully', async () => {
    const hash = await passwordService.hash('Password123!');
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@betacorp.com',
      passwordHash: hash,
      tenantId: 'tenant-1',
      status: 'ACTIVE',
    });

    const result = await service.login({
      email: 'owner@betacorp.com',
      password: 'Password123!',
    });

    expect(result.user.email).toBe('owner@betacorp.com');
    expect(result.tokens.accessToken).toBeDefined();
  });
});
