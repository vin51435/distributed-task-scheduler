import { ScannerService } from '../../../../apps/scanner/src/scanner/scanner.service';
import { DispatcherService } from '../../../../apps/dispatcher/src/dispatcher/dispatcher.service';
import { calculateBucket } from '@scheduler-platform/redis';

describe('Distributed Coordination & Scaling (Phase 8 Integration)', () => {
  let mockLockService: any;
  let mockLeaderService: any;
  let mockBucketService: any;
  let mockHeartbeatService: any;
  let mockIdempotencyService: any;
  let mockScannerRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const bucketLeases = new Map<number, string>();
    const activeLocks = new Set<string>();
    const idempotencyKeys = new Set<string>();
    let currentLeader: string | null = null;

    mockLockService = {
      acquireLock: jest.fn(async (key: string) => {
        if (activeLocks.has(key)) return null;
        activeLocks.add(key);
        return 'token-123';
      }),
      releaseLock: jest.fn(async (key: string) => {
        activeLocks.delete(key);
        return true;
      }),
    };

    mockLeaderService = {
      acquireLeadership: jest.fn(async (key: string, instanceId: string) => {
        if (currentLeader === null || currentLeader === instanceId) {
          currentLeader = instanceId;
          return true;
        }
        return false;
      }),
      renewLeadership: jest.fn(async (key: string, instanceId: string) => {
        return currentLeader === instanceId;
      }),
      releaseLeadership: jest.fn(async (key: string, instanceId: string) => {
        if (currentLeader === instanceId) {
          currentLeader = null;
          return true;
        }
        return false;
      }),
    };

    mockBucketService = {
      getActiveInstancesCount: jest.fn(async () => 3),
      claimBuckets: jest.fn(
        async (totalBuckets: number, instanceId: string, ttlMs?: number, activeInstances = 3) => {
          const maxQuota = Math.ceil(totalBuckets / activeInstances);
          const claimed: number[] = [];
          for (let i = 0; i < totalBuckets; i++) {
            if (claimed.length >= maxQuota) break;
            if (!bucketLeases.has(i) || bucketLeases.get(i) === instanceId) {
              bucketLeases.set(i, instanceId);
              claimed.push(i);
            }
          }
          return claimed;
        },
      ),
    };

    mockHeartbeatService = {
      sendHeartbeat: jest.fn(async () => {}),
      isAlive: jest.fn(async () => true),
      clearHeartbeat: jest.fn(async () => {}),
    };

    mockIdempotencyService = {
      checkAndSet: jest.fn(async (key: string) => {
        if (idempotencyKeys.has(key)) return false;
        idempotencyKeys.add(key);
        return true;
      }),
      clear: jest.fn(async (key: string) => {
        idempotencyKeys.delete(key);
      }),
    };

    mockScannerRepo = {
      findDueSchedules: jest.fn(async (now: Date, batchSize: number, buckets?: number[]) => {
        const sampleSchedules = [
          {
            id: 'sched-1',
            payload: { task: 1 },
            nextExecuteAt: now,
            bucket: calculateBucket('sched-1', 60),
          },
          {
            id: 'sched-2',
            payload: { task: 2 },
            nextExecuteAt: now,
            bucket: calculateBucket('sched-2', 60),
          },
          {
            id: 'sched-3',
            payload: { task: 3 },
            nextExecuteAt: now,
            bucket: calculateBucket('sched-3', 60),
          },
        ];

        if (buckets && buckets.length > 0) {
          return sampleSchedules.filter((s) => buckets.includes(s.bucket));
        }
        return sampleSchedules;
      }),
      createJob: jest.fn(async (data: any) => ({ id: 'job-' + Math.random(), ...data })),
      updateSchedule: jest.fn(async () => {}),
    };
  });

  describe('Multi-Instance Scanner Bucketing & Locking', () => {
    it('should partition 60 buckets across 3 concurrent Scanners without overlapping job creation', async () => {
      const scannerA = new ScannerService(
        mockScannerRepo,
        { get: (k: string) => (k === 'SCANNER_INSTANCE_ID' ? 'scanner-A' : null) } as any,
        mockLockService,
        mockLeaderService,
        mockBucketService,
        mockHeartbeatService,
      );

      const scannerB = new ScannerService(
        mockScannerRepo,
        { get: (k: string) => (k === 'SCANNER_INSTANCE_ID' ? 'scanner-B' : null) } as any,
        mockLockService,
        mockLeaderService,
        mockBucketService,
        mockHeartbeatService,
      );

      const scannerC = new ScannerService(
        mockScannerRepo,
        { get: (k: string) => (k === 'SCANNER_INSTANCE_ID' ? 'scanner-C' : null) } as any,
        mockLockService,
        mockLeaderService,
        mockBucketService,
        mockHeartbeatService,
      );

      const [resA, resB, resC] = await Promise.all([
        scannerA.scan(),
        scannerB.scan(),
        scannerC.scan(),
      ]);

      const allClaimed = [
        ...(resA.claimedBuckets || []),
        ...(resB.claimedBuckets || []),
        ...(resC.claimedBuckets || []),
      ];

      expect(allClaimed.length).toBe(60);
      const uniqueBuckets = new Set(allClaimed);
      expect(uniqueBuckets.size).toBe(60);

      const totalJobsCreated = resA.jobsCreated + resB.jobsCreated + resC.jobsCreated;
      expect(totalJobsCreated).toBe(3);
    });

    it('should handle Leader Failover seamlessly when Leader Scanner is terminated', async () => {
      const configLeader = {
        get: (k: string) =>
          k === 'SCANNER_MODE' ? 'LEADER' : k === 'SCANNER_INSTANCE_ID' ? 'scanner-Leader-1' : null,
      } as any;

      const configFollower = {
        get: (k: string) =>
          k === 'SCANNER_MODE' ? 'LEADER' : k === 'SCANNER_INSTANCE_ID' ? 'scanner-Leader-2' : null,
      } as any;

      const scanner1 = new ScannerService(
        mockScannerRepo,
        configLeader,
        mockLockService,
        mockLeaderService,
        null as any,
        mockHeartbeatService,
      );

      const scanner2 = new ScannerService(
        mockScannerRepo,
        configFollower,
        mockLockService,
        mockLeaderService,
        null as any,
        mockHeartbeatService,
      );

      const res1 = await scanner1.scan();
      expect(res1.isLeader).toBe(true);
      expect(res1.jobsCreated).toBe(3);

      const res2 = await scanner2.scan();
      expect(res2.isLeader).toBe(false);
      expect(res2.jobsCreated).toBe(0);

      await mockLeaderService.releaseLeadership('scheduler:leader', 'scanner-Leader-1');

      const res2AfterFailover = await scanner2.scan();
      expect(res2AfterFailover.isLeader).toBe(true);
      expect(res2AfterFailover.jobsCreated).toBe(3);
    });
  });

  describe('Multi-Instance Dispatcher Idempotency', () => {
    it('should prevent duplicate publishing when 5 Dispatchers attempt to dispatch the same jobs', async () => {
      const mockDispatcherRepo = {
        fetchAndClaimReadyJobs: jest.fn(async () => [
          { id: 'job-100', workerType: 'EMAIL', routingKey: 'worker.email', payload: {} },
          { id: 'job-101', workerType: 'WEBHOOK', routingKey: 'worker.webhook', payload: {} },
        ]),
        findReadyJobs: jest.fn(async () => [
          { id: 'job-100', workerType: 'EMAIL', routingKey: 'worker.email', payload: {} },
          { id: 'job-101', workerType: 'WEBHOOK', routingKey: 'worker.webhook', payload: {} },
        ]),
        updateJobStatus: jest.fn(async () => {}),
        findStuckJobs: jest.fn(async () => []),
      };

      const mockPublisher = {
        publish: jest.fn(async () => {}),
      };

      const dispatchers = Array.from({ length: 5 }, (_, i) => {
        return new DispatcherService(
          mockDispatcherRepo as any,
          mockPublisher as any,
          {
            get: (k: string) => (k === 'DISPATCHER_INSTANCE_ID' ? `dispatcher-${i}` : null),
          } as any,
          mockLockService,
          mockIdempotencyService,
          mockHeartbeatService,
        );
      });

      const results = await Promise.all(dispatchers.map((d) => d.dispatchBatch()));

      const totalDispatched = results.reduce((acc: number, r: any) => acc + r.dispatched, 0);

      expect(totalDispatched).toBe(2);
      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
    });
  });
});
