import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { ExecutionService } from '../worker/execution.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let executionService: jest.Mocked<ExecutionService>;

  beforeEach(async () => {
    const mockExecService = {
      getMetrics: jest.fn().mockReturnValue({
        totalProcessed: 5,
        totalSucceeded: 4,
        totalFailed: 1,
        activeExecutions: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: ExecutionService, useValue: mockExecService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    executionService = module.get(ExecutionService);
  });

  it('should return status ok and current execution metrics', () => {
    const res = controller.getMetrics();
    expect(res.status).toBe('ok');
    expect(res.metrics).toEqual({
      totalProcessed: 5,
      totalSucceeded: 4,
      totalFailed: 1,
      activeExecutions: 0,
    });
    expect(executionService.getMetrics).toHaveBeenCalled();
  });
});
