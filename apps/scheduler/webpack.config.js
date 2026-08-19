const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  config.devtool = 'source-map';
  config.output = {
    ...config.output,
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
  };
  return config;
});
