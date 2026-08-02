import { Test, TestingModule } from '@nestjs/testing';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

describe('ScannerController', () => {
  let controller: ScannerController;
  let service: jest.Mocked<ScannerService>;

  beforeEach(async () => {
    const mockService = {
      scan: jest.fn().mockResolvedValue({ scannedSchedules: 2, jobsCreated: 2 }),
      getMetrics: jest.fn().mockReturnValue({
        totalScans: 5,
        jobsCreated: 10,
        lastScanTime: new Date('2026-08-02T12:00:00Z'),
        pollingIntervalMs: 5000,
        batchSize: 500,
        isPollingActive: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScannerController],
      providers: [
        {
          provide: ScannerService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ScannerController>(ScannerController);
    service = module.get(ScannerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return status ok and uptime', () => {
      const health = controller.getHealth();
      expect(health.status).toBe('ok');
      expect(typeof health.uptime).toBe('number');
    });
  });

  describe('triggerScan', () => {
    it('should manually invoke scanner scan() method', async () => {
      const result = await controller.triggerScan();
      expect(service.scan).toHaveBeenCalled();
      expect(result).toEqual({ scannedSchedules: 2, jobsCreated: 2 });
    });
  });

  describe('getMetrics', () => {
    it('should return operational metrics from ScannerService', () => {
      const metrics = controller.getMetrics();
      expect(service.getMetrics).toHaveBeenCalled();
      expect(metrics.totalScans).toBe(5);
      expect(metrics.jobsCreated).toBe(10);
    });
  });
});
