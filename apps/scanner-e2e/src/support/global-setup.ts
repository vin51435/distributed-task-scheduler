import { waitForPortOpen } from '@nx/node/utils';

module.exports = async function () {
  console.log('\nSetting up scanner e2e tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.SCANNER_PORT ? Number(process.env.SCANNER_PORT) : 3002;

  await waitForPortOpen(port, { host });

  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down scanner e2e tests...\n';
};
