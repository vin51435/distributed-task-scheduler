import { Test, TestingModule } from '@nestjs/testing';
import { DispatcherController } from './dispatcher.controller';
import { DispatcherService } from './dispatcher.service';

describe('DispatcherController', () => {
  let controller: DispatcherController;
  let service: jest.Mocked<DispatcherService>;

  beforeEach(async () => {
    const mockService = {
      dispatchBatch: jest.fn().mockResolvedValue({ fetched: 1, dispatched: 1, failed: 0 }),
      getMetrics: jest.fn().mockReturnValue({
        totalDispatched: 1,
        totalFailed: 0,
        lastDispatchTime: new Date(),
        pollingIntervalMs: 2000,
        batchSize: 500,
        isPollingActive: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispatcherController],
      providers: [
        {
          provide: DispatcherService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DispatcherController>(DispatcherController);
    service = module.get(DispatcherService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerDispatch', () => {
    it('should trigger dispatchBatch and return result', async () => {
      const response = await controller.triggerDispatch();

      expect(service.dispatchBatch).toHaveBeenCalled();
      expect(response).toEqual({
        message: 'Dispatch batch completed',
        data: { fetched: 1, dispatched: 1, failed: 0 },
      });
    });
  });

  describe('getMetrics', () => {
    it('should return operational metrics', () => {
      const response = controller.getMetrics();

      expect(service.getMetrics).toHaveBeenCalled();
      expect(response.data.totalDispatched).toBe(1);
    });
  });
});
