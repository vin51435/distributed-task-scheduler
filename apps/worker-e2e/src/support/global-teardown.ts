module.exports = async function () {
  const child = (globalThis as any).__APP_CHILD_PROCESS__;
  if (child) {
    console.log('[worker-e2e] Stopping spawned server process...');
    child.kill('SIGTERM');
  }
  console.log((globalThis as any).__TEARDOWN_MESSAGE__);
};
