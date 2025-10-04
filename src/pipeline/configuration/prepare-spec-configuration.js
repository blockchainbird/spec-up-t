/**
 * Handles configuration and initialization tasks before rendering specs.
 * This module centralizes setup logic to reduce complexity in index.js.
 * It loads config, runs validators, prepares external specs, and initializes shared variables.
 */

const fs = require('fs-extra');
const path = require('path');
const findPkgDir = require('find-pkg-dir');

const { initialize } = require('../../init.js');
const Logger = require('../../utils/logger.js');
const { runJsonKeyValidatorSync } = require('../../json-key-validator.js');
const { createTermIndex } = require('./create-term-index.js');
const { insertTermIndex } = require('./insert-term-index.js');
const { normalizeTerminologyMarkdown } = require('../preprocessing/normalize-terminology-markdown.js');

/**
 * Initializes configuration and shared variables for spec processing.
 * @param {Object} options - Options passed to the main function.
 * @returns {Object} An object containing config, externalSpecsList, template, assets, and other shared variables.
 */
async function initializeConfig(options = {}) {
  try {
    await initialize();

    runJsonKeyValidatorSync();
    createTermIndex();
    insertTermIndex();

    const modulePath = findPkgDir(__dirname);
    let config = fs.readJsonSync('./.cache/specs-generated.json');

    const createExternalSpecsList = require('./create-external-specs-list.js');
    const externalSpecsList = createExternalSpecsList(config);

    const createVersionsIndex = require('./create-versions-index.js');
    createVersionsIndex(config.specs[0].output_path);

    normalizeTerminologyMarkdown(path.join(config.specs[0].spec_directory, config.specs[0].spec_terms_directory));

    let template = fs.readFileSync(path.join(modulePath, 'templates/template.html'), 'utf8');
    let assets = fs.readJsonSync(modulePath + '/config/asset-map.json');

    // Initialize shared variables
    let externalReferences;
    let references = [];
    let definitions = [];
    let toc;
    let specGroups = {};
    let noticeTitles = {};

    return {
      config,
      externalSpecsList,
      template,
      assets,
      externalReferences,
      references,
      definitions,
      specGroups,
      noticeTitles
    };
  } catch (error) {
    Logger.error(`Error during configuration initialization: ${error.message}`);
    throw error;
  }
}

module.exports = { initializeConfig };
