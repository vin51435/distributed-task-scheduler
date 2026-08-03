import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ScheduleStatus, ScheduleType } from '../src/schedule/entities/schedule.entity';

describe('ScheduleController (e2e)', () => {
  let app: INestApplication;
  let createdScheduleId: string;

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
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /api/schedules - should create a new CRON schedule', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/schedules')
      .send({
        name: 'E2E Cleanup Schedule',
        description: 'E2E Test Description',
        type: ScheduleType.CRON,
        cron: '0 12 * * *',
        timezone: 'UTC',
        payload: { test: true },
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toEqual('E2E Cleanup Schedule');
    expect(response.body.type).toEqual(ScheduleType.CRON);
    expect(response.body.status).toEqual(ScheduleStatus.ACTIVE);

    createdScheduleId = response.body.id;
  });

  it('GET /api/schedules - should return array of schedules', async () => {
    const response = await request(app.getHttpServer()).get('/api/schedules').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('GET /api/schedules/:id - should return single schedule by ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/schedules/${createdScheduleId}`)
      .expect(200);

    expect(response.body.id).toEqual(createdScheduleId);
    expect(response.body.name).toEqual('E2E Cleanup Schedule');
  });

  it('PATCH /api/schedules/:id - should update schedule', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/schedules/${createdScheduleId}`)
      .send({
        name: 'Updated E2E Schedule',
        status: ScheduleStatus.PAUSED,
      })
      .expect(200);

    expect(response.body.name).toEqual('Updated E2E Schedule');
    expect(response.body.status).toEqual(ScheduleStatus.PAUSED);
  });

  it('DELETE /api/schedules/:id - should delete schedule', async () => {
    await request(app.getHttpServer()).delete(`/api/schedules/${createdScheduleId}`).expect(204);

    await request(app.getHttpServer()).get(`/api/schedules/${createdScheduleId}`).expect(404);
  });
});
