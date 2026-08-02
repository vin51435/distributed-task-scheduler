import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ConnectionService } from '@scheduler/rabbitmq';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;
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
    dataSource = module.get(DataSource);
    rabbitConnection = module.get(ConnectionService);
  });

  it('should return ok when DB and RabbitMQ are connected', async () => {
    const health = await controller.check();
    expect(health.status).toBe('ok');
    expect(health.details).toEqual({
      database: 'connected',
      rabbitmq: 'connected',
    });
  });

  it('should return degraded when RabbitMQ is disconnected', async () => {
    rabbitConnection.getIsConnected.mockReturnValueOnce(false);
    const health = await controller.check();
    expect(health.status).toBe('degraded');
    expect(health.details.rabbitmq).toBe('disconnected');
  });
});
