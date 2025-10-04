/**
 * Legacy entry point preserved for backwards compatibility with existing installations.
 *
 * The original interactive implementation now lives in
 * `src/pipeline/configuration/configure-starterpack.js`. Requiring that module keeps the
 * behaviour identical (including auto-run) while new code can import the functional helper
 * directly from the pipeline path.
 */

const configurator = require('./pipeline/configuration/configure-starterpack');

module.exports = configurator;
