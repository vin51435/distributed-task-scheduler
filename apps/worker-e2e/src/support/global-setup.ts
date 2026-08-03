import { waitForPortOpen } from '@nx/node/utils';

module.exports = async function () {
  console.log('\nSetting up worker e2e tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.WORKER_PORT ? Number(process.env.WORKER_PORT) : 3004;

  await waitForPortOpen(port, { host });

  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down worker e2e tests...\n';
};
