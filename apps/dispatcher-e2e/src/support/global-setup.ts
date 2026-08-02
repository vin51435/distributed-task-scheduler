import { waitForPortOpen } from '@nx/node/utils';

module.exports = async function () {
  console.log('\nSetting up dispatcher e2e tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.DISPATCHER_PORT ? Number(process.env.DISPATCHER_PORT) : 3003;

  await waitForPortOpen(port, { host });

  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down dispatcher e2e tests...\n';
};
