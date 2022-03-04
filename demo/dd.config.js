const CleanPluginForCommand = require('./plugin/clean.plugin');

module.exports = {
  plugins: {
    commands: [CleanPluginForCommand('hello world!')],
    webpack: {},
    babel: {}
  }
}
