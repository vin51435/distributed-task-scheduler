import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ScannerService } from '../src/scanner/scanner.service';

describe('ScannerController (e2e)', () => {
  let app: INestApplication;
  let scannerService: ScannerService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');
    scannerService = moduleFixture.get<ScannerService>(ScannerService);
    scannerService.stopPolling();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/health - should return status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toEqual('ok');
  });

  it('POST /api/scan - should execute scan and return summary', async () => {
    const response = await request(app.getHttpServer()).post('/api/scan').expect(200);
    expect(response.body).toHaveProperty('scannedSchedules');
    expect(response.body).toHaveProperty('jobsCreated');
  });

  it('GET /api/metrics - should return Prometheus scanner metrics', async () => {
    const response = await request(app.getHttpServer()).get('/api/metrics').expect(200);
    expect(response.text).toContain('scanner_jobs_created_total');
  });
});
