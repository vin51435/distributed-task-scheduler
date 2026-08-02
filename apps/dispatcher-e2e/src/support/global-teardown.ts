module.exports = async function () {
  console.log((globalThis as any).__TEARDOWN_MESSAGE__);
};
