import { Test, TestingModule } from '@nestjs/testing';
import { LockService } from './lock.service';
import { RedisService } from '../redis.service';

describe('LockService', () => {
  let lockService: LockService;

  const mockRedisClient = {
    set: jest.fn(),
    eval: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LockService,
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
      ],
    }).compile();

    lockService = module.get<LockService>(LockService);
  });

  it('should acquire lock successfully when SET returns OK', async () => {
    mockRedisClient.set.mockResolvedValue('OK');

    const token = await lockService.acquireLock('lock:test', 5000, 'my-token');

    expect(token).toBe('my-token');
    expect(mockRedisClient.set).toHaveBeenCalledWith('lock:test', 'my-token', 'PX', 5000, 'NX');
  });

  it('should return null when lock is already held', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    const token = await lockService.acquireLock('lock:test', 5000);

    expect(token).toBeNull();
  });

  it('should release lock successfully when token matches', async () => {
    mockRedisClient.eval.mockResolvedValue(1);

    const released = await lockService.releaseLock('lock:test', 'my-token');

    expect(released).toBe(true);
    expect(mockRedisClient.eval).toHaveBeenCalled();
  });

  it('should fail to release lock when token does not match', async () => {
    mockRedisClient.eval.mockResolvedValue(0);

    const released = await lockService.releaseLock('lock:test', 'wrong-token');

    expect(released).toBe(false);
  });
});
