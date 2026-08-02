/* eslint-disable */

module.exports = async function () {
  console.log((globalThis as any).__TEARDOWN_MESSAGE__ || '\nTearing down scanner e2e tests...\n');
};
