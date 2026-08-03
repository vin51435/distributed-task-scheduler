import { Test, TestingModule } from '@nestjs/testing';
import { PublisherService } from './publisher.service';
import { ConnectionService } from './connection.service';

describe('PublisherService', () => {
  let service: PublisherService;
  let connectionServiceMock: { getChannelWrapper: jest.Mock };
  let channelWrapperMock: { publish: jest.Mock };

  beforeEach(async () => {
    channelWrapperMock = {
      publish: jest.fn(),
    };

    connectionServiceMock = {
      getChannelWrapper: jest.fn().mockReturnValue(channelWrapperMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublisherService,
        {
          provide: ConnectionService,
          useValue: connectionServiceMock,
        },
      ],
    }).compile();

    service = module.get<PublisherService>(PublisherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should successfully publish a message when publisher confirm succeeds (ACK)', async () => {
      channelWrapperMock.publish.mockResolvedValueOnce(undefined);

      const result = await service.publish('scheduler.exchange', 'job.execute', {
        jobId: 'job-123',
      });

      expect(result).toBe(true);
      expect(channelWrapperMock.publish).toHaveBeenCalledWith(
        'scheduler.exchange',
        'job.execute',
        { jobId: 'job-123' },
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
        }),
      );
    });

    it('should throw an error when publisher confirm fails (NACK / rejection)', async () => {
      channelWrapperMock.publish.mockRejectedValueOnce(new Error('Broker NACK'));

      await expect(
        service.publish('scheduler.exchange', 'job.execute', { jobId: 'job-123' }),
      ).rejects.toThrow('Broker NACK');
    });

    it('should throw an error when confirm timeout occurs', async () => {
      channelWrapperMock.publish.mockRejectedValueOnce(new Error('Publish confirm timeout'));

      await expect(
        service.publish('scheduler.exchange', 'job.execute', { jobId: 'job-123' }),
      ).rejects.toThrow('Publish confirm timeout');
    });
  });
});
