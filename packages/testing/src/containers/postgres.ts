import { GenericContainer, StartedTestContainer } from 'testcontainers';

export async function createPostgresContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_DB: 'scheduler_test_db',
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres',
    })
    .withExposedPorts(5432)
    .start();
}
