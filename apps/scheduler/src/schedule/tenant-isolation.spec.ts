import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { ScheduleService } from './schedule.service';
import { ScheduleRepository } from './schedule.repository';
import {
  JobEntity,
  JobStatus,
  ExecutionEntity,
  ScheduleEntity,
  JobAuditEntity,
  TenantLimitsEntity,
} from '@scheduler/database';

describe('Tenant Isolation Hardening Tests', () => {
  let adminService: AdminService;
  let jobRepo: jest.Mocked<Repository<JobEntity>>;
  let scheduleRepo: jest.Mocked<Repository<ScheduleEntity>>;

  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        ScheduleService,
        ScheduleRepository,
        {
          provide: getRepositoryToken(JobEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
          },
        },
        {
          provide: getRepositoryToken(ExecutionEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScheduleEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
            saveMany: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JobAuditEntity),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TenantLimitsEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
    jobRepo = module.get(getRepositoryToken(JobEntity));
    scheduleRepo = module.get(getRepositoryToken(ScheduleEntity));
  });

  describe('Admin Job Operations Isolation', () => {
    it('should strictly query only jobs belonging to the authenticated tenant in search', async () => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'job-1', tenantId: TENANT_A }], 1]),
      };
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await adminService.searchJobs({
        tenantId: TENANT_A,
        status: JobStatus.READY,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('job.tenant_id = :tenantId', {
        tenantId: TENANT_A,
      });
      expect(result.jobs[0].tenantId).toBe(TENANT_A);
    });

    it('should reject Tenant B trying to retry Tenant A job', async () => {
      // Mock findOne: when querying with tenantId=TENANT_B, Tenant A's job is not found
      jobRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === 'job-tenant-a' && options?.where?.tenantId === TENANT_B) {
          return null; // not found for Tenant B
        }
        return { id: 'job-tenant-a', tenantId: TENANT_A } as any;
      });

      await expect(adminService.retryJob('job-tenant-a', TENANT_B)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject Tenant B trying to cancel Tenant A job', async () => {
      jobRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === 'job-tenant-a' && options?.where?.tenantId === TENANT_B) {
          return null;
        }
        return { id: 'job-tenant-a', tenantId: TENANT_A } as any;
      });

      await expect(adminService.cancelJob('job-tenant-a', TENANT_B)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject Tenant B trying to pause Tenant A schedule', async () => {
      scheduleRepo.findOne.mockImplementation(async (options: any) => {
        if (options?.where?.id === 'sched-tenant-a' && options?.where?.tenantId === TENANT_B) {
          return null;
        }
        return { id: 'sched-tenant-a', tenantId: TENANT_A } as any;
      });

      await expect(adminService.pauseSchedule('sched-tenant-a', TENANT_B)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
