/**
 * @file Compatibility wrapper forwarding to the pipeline-based reference modules.
 *
 * External callers historically required this path, so we re-export the relocated
 * implementations to preserve the public API while keeping the new directory layout.
 */

const pipelineModule = require('./pipeline/references/collect-external-references');
const xtrefUtils = require('./pipeline/references/xtref-utils');

module.exports = {
    ...pipelineModule,
    ...xtrefUtils
};
