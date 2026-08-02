import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  console.log('\nSetting up e2e tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.SCHEDULER_PORT
    ? Number(process.env.SCHEDULER_PORT)
    : process.env.PORT
      ? Number(process.env.PORT)
      : 3001;

  await waitForPortOpen(port, { host });

  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down e2e tests...\n';
};
