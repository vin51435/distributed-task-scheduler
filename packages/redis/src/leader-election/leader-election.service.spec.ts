import { Test, TestingModule } from '@nestjs/testing';
import { LeaderElectionService } from './leader-election.service';
import { RedisService } from '../redis.service';

describe('LeaderElectionService', () => {
  let leaderService: LeaderElectionService;

  const mockRedisClient = {
    set: jest.fn(),
    eval: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderElectionService,
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
      ],
    }).compile();

    leaderService = module.get<LeaderElectionService>(LeaderElectionService);
  });

  it('should acquire leadership when key is free', async () => {
    mockRedisClient.set.mockResolvedValue('OK');

    const result = await leaderService.acquireLeadership('scheduler:leader', 'scanner-1', 10);

    expect(result).toBe(true);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'scheduler:leader',
      'scanner-1',
      'EX',
      10,
      'NX',
    );
  });

  it('should fail leadership acquisition when another node holds it', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    const result = await leaderService.acquireLeadership('scheduler:leader', 'scanner-2', 10);

    expect(result).toBe(false);
  });

  it('should renew leadership if current leader matches', async () => {
    mockRedisClient.eval.mockResolvedValue(1);

    const renewed = await leaderService.renewLeadership('scheduler:leader', 'scanner-1', 10);

    expect(renewed).toBe(true);
  });
});
