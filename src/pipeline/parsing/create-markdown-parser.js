/**
 * Configures and exports a fully set up markdown-it instance.
 * This module integrates custom extensions, plugins, and related constants.
 * It centralizes markdown parsing setup to reduce complexity in index.js.
 */

const MarkdownIt = require('markdown-it');
const containers = require('markdown-it-container');
const path = require('path');
const fs = require('fs-extra');
const findPkgDir = require('find-pkg-dir');

const { configurePlugins } = require('../../markdown-it/plugins');
const { createTemplateTagParser, createSpecParser } = require('../../parsers');
const { whitespace, templateTags } = require('../../utils/regex-patterns.js');

// Constants used in markdown parsing
const noticeTypes = {
  note: 1,
  issue: 1,
  example: 1,
  warning: 1,
  todo: 1
};
// Domain-specific regex patterns for markdown parsing (now centralized)
const specNameRegex = templateTags.specName;
const templateTagRegex = templateTags.terminology;

// Load spec corpus
const modulePath = findPkgDir(__dirname);
const specCorpus = fs.readJsonSync(path.join(modulePath, 'assets/compiled/refs.json'));

// Global variables (shared across renders)
let definitions = global.definitions;
let references = global.references;
let specGroups = global.specGroups;
let noticeTitles = global.noticeTitles;

/**
 * Creates and configures a markdown-it instance with extensions and plugins.
 * @param {Object} config - Configuration object (e.g., for anchor symbol).
 * @param {Function} setToc - Function to set the table of contents HTML.
 * @returns {Object} The configured markdown-it instance.
 */
function createMarkdownParser(config, setToc) {
  // Create parser functions with bound dependencies - cleaner than classes
  const templateTagParser = createTemplateTagParser(config, global);
  const specParser = createSpecParser(specCorpus, global);

  let md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  })
  .use(require('./apply-markdown-it-extensions.js'), [
      /*
        The first extension focuses on template-tag constructs.
        All complex logic is now delegated to pure functions.
      */
      {
        filter: type => type.match(templateTagRegex),
        parse: (token, type, primary) => templateTagParser(token, type, primary)
      },
      /*
        The second extension handles specification references.
        All complex logic is now delegated to pure functions.
      */
      {
        filter: type => type.match(specNameRegex),
        parse: (token, type, name) => specParser.parseSpecReference(token, type, name),
        render: (token, type, name) => specParser.renderSpecReference(token, type, name)
      }
    ]);

  md = configurePlugins(md, config, containers, noticeTypes, global.noticeTitles, setToc);

  return md;
}

module.exports = { 
  createMarkdownParser, 
  noticeTypes, 
  spaceRegex: whitespace.oneOrMore, 
  specNameRegex, 
  templateTagRegex, 
  specCorpus, 
  definitions, 
  references, 
  specGroups, 
  noticeTitles,
  // Export parsers for direct access if needed
  createTemplateTagParser,
  createSpecParser
};
