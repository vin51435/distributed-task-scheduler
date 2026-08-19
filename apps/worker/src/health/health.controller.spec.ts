import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConnectionService } from '@scheduler-platform/rabbitmq';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let rabbitConnection: jest.Mocked<ConnectionService>;

  beforeEach(async () => {
    const mockDataSource = {
      isInitialized: true,
    };

    const mockRabbitConnection = {
      getIsConnected: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConnectionService, useValue: mockRabbitConnection },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    rabbitConnection = module.get(ConnectionService);
  });

  it('should return liveness ok', () => {
    const live = controller.live();
    expect(live.status).toBe('ok');
    expect(live.service).toBe('worker-service');
  });

  it('should return readiness ok when DB and RabbitMQ are connected', async () => {
    const health = await controller.ready();
    expect(health.status).toBe('ok');
    expect(health.checks).toEqual({
      database: 'connected',
      rabbitmq: 'connected',
    });
  });

  it('should return error when RabbitMQ is disconnected', async () => {
    rabbitConnection.getIsConnected.mockReturnValueOnce(false);
    const res: any = { status: jest.fn() };
    const health = await controller.ready(res);
    expect(health.status).toBe('error');
    expect(health.checks.rabbitmq).toBe('disconnected');
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
