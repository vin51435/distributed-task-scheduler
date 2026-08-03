import { Test, TestingModule } from '@nestjs/testing';
import { BucketService, calculateBucket } from './bucket.service';
import { RedisService } from '../redis.service';

describe('BucketService', () => {
  let bucketService: BucketService;

  const mockRedisClient = {
    set: jest.fn(),
    eval: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BucketService,
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
      ],
    }).compile();

    bucketService = module.get<BucketService>(BucketService);
  });

  it('should calculate bucket index consistently within 0..59 range', () => {
    const b1 = calculateBucket('schedule-123', 60);
    const b2 = calculateBucket('schedule-123', 60);
    expect(b1).toBe(b2);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(60);
  });

  it('should acquire bucket lease when available', async () => {
    mockRedisClient.set.mockResolvedValue('OK');

    const acquired = await bucketService.acquireBucketLease(12, 'scanner-instance-1', 15000);

    expect(acquired).toBe(true);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'bucket:lease:12',
      'scanner-instance-1',
      'PX',
      15000,
      'NX',
    );
  });

  it('should claim multiple buckets dynamically', async () => {
    mockRedisClient.eval.mockResolvedValue(0); // renewal fails
    mockRedisClient.set.mockImplementation((key: string, inst: string) => {
      // Allow acquiring odd numbered buckets
      const b = parseInt(key.split(':')[2], 10);
      return Promise.resolve(b % 2 === 1 ? 'OK' : null);
    });

    const claimed = await bucketService.claimBuckets(10, 'scanner-1', 15000);

    expect(claimed).toEqual([1, 3, 5, 7, 9]);
  });
});
