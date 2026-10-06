// All build caches stay in this worktree; node_modules is a read-only shared symlink.
const path = require('path');
process.env.NODE_ENV = 'production';
process.env.GENERATE_SOURCEMAP = 'false';
const paths = require('react-scripts/config/paths');
paths.appWebpackCache = path.resolve('_home/cache/webpack');
paths.appTsBuildInfoFile = path.resolve('_home/cache/tsbuildinfo');
const name = require.resolve('react-scripts/config/webpack.config');
const original = require(name);
require.cache[name].exports = env => {
  const config = original(env);
  const visit = rules => rules.forEach(r => { if (r.options?.cacheDirectory) r.options.cacheDirectory = path.resolve('_home/cache/babel'); if (r.oneOf) visit(r.oneOf); if (r.rules) visit(r.rules); });
  visit(config.module.rules);
  config.plugins.forEach(plugin => { if (plugin.constructor.name === 'ESLintWebpackPlugin') plugin.options.cacheLocation = path.resolve('_home/cache/eslint'); });
  return config;
};
require('react-scripts/scripts/build');
