import { waitForPortOpen } from '@nx/node/utils';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

module.exports = async function () {
  console.log('\nSetting up dispatcher e2e tests...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.DISPATCHER_PORT ? Number(process.env.DISPATCHER_PORT) : 3003;

  try {
    await waitForPortOpen(port, { host, retries: 2, retryDelay: 200 });
    console.log(`[dispatcher-e2e] Server already listening on port ${port}`);
  } catch {
    console.log(`[dispatcher-e2e] Spawning dispatcher service on port ${port}...`);
    const appPath = path.resolve(__dirname, '../../../../dist/apps/dispatcher/main.js');

    const child: ChildProcess = spawn(process.execPath, [appPath], {
      env: { ...process.env, PORT: String(port), DISPATCHER_PORT: String(port) },
      stdio: 'ignore',
      detached: false,
    });

    (globalThis as any).__APP_CHILD_PROCESS__ = child;
    await waitForPortOpen(port, { host, retries: 25, retryDelay: 400 });
    console.log(`[dispatcher-e2e] Server started successfully on port ${port}`);
  }

  (globalThis as any).__TEARDOWN_MESSAGE__ = '\nTearing down dispatcher e2e tests...\n';
};
