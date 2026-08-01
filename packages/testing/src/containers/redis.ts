import { GenericContainer, StartedTestContainer } from 'testcontainers';

export async function createRedisContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
}
