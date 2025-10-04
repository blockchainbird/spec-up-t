/**
 * Utility functions for rendering and processing specs.
 * This module centralizes helper functions to reduce complexity in index.js.
 * These functions handle tasks like path normalization, term lookups, and markdown processing.
 */

const fs = require('fs-extra');
const path = require('path');
const { templateTags, paths, whitespace } = require('../../utils/regex-patterns.js');

// Constants used in rendering and processing
const katexRules = ['math_block', 'math_inline'];
const replacerRegex = templateTags.replacer;
const replacerArgsRegex = templateTags.argsSeparator;
const replacers = [
  {
    test: 'insert',
    transform: function (originalMatch, type, path) {
      if (!path) return '';
      return fs.readFileSync(path, 'utf8');
    }
  }
];

/**
 * Creates a script element containing XTref data for embedding in HTML.
 * Tests if xtrefs-data.js exists; if not, returns an empty string.
 * @returns {string} The script element or empty string.
 */
function createScriptElementWithXTrefDataForEmbeddingInHtml() {
  const inputPath = path.join('.cache', 'xtrefs-data.js');
  let xtrefsData = '';
  if (fs.existsSync(inputPath)) {
    xtrefsData = '<script>' + fs.readFileSync(inputPath, 'utf8') + '</script>';
  }
  return xtrefsData;
}

/**
 * Looks up an xref term from the allXTrefs data.
 * @param {string} externalSpec - The external spec identifier.
 * @param {string} termName - The term name to look up.
 * @returns {Object|null} The term object if found, null otherwise.
 */
function lookupXrefTerm(externalSpec, termName) {
  try {
    const xtrefsPath = path.join('.cache', 'xtrefs-data.json');
    if (!fs.existsSync(xtrefsPath)) {
      return null;
    }

    const allXTrefs = fs.readJsonSync(xtrefsPath);
    if (!allXTrefs || !allXTrefs.xtrefs) {
      return null;
    }

    const termKey = termName.replace(whitespace.oneOrMore, '-').toLowerCase();
    const foundTerm = allXTrefs.xtrefs.find(xtref =>
      xtref.externalSpec === externalSpec &&
      xtref.term === termKey &&
      xtref.source === 'xref'
    );

    return foundTerm || null;
  } catch (error) {
    console.warn(`Error looking up xref term ${externalSpec}:${termName}:`, error.message);
    return null;
  }
}

/**
 * Processes custom tag patterns in markdown content and applies transformation functions.
 * Scans for patterns like [[tref:spec,term]] and replaces them with HTML equivalents.
 * @param {string} doc - The markdown document to process.
 * @returns {string} The processed document with tags replaced.
 */
function applyReplacers(doc) {
  const { processWithEscapes } = require('../preprocessing/escape-processor.js');
  return processWithEscapes(doc, function (content) {
    return content.replace(replacerRegex, function (match, type, args) {
      let replacer = replacers.find(r => type.trim().match(r.test));
      if (replacer) {
        let argsArray = args ? args.trim().split(replacerArgsRegex) : [];
        return replacer.transform(match, type, ...argsArray);
      }
      return match;
    });
  });
}

/**
 * Normalizes a path by trimming trailing slashes and adding a leading slash.
 * @param {string} path - The path to normalize.
 * @returns {string} The normalized path.
 */
function normalizePath(path) {
  return path.trim().replace(paths.trailingSlash, '') + '/';
}

/**
 * Renders a reference group for a given type.
 * @param {string} type - The type of reference group.
 * @param {Object} specGroups - The spec groups object.
 * @returns {string} The rendered HTML for the reference group.
 */
function renderRefGroup(type, specGroups) {
  let group = specGroups[type];
  if (!group) return '';

  let html = Object.keys(group).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).reduce((html, name) => {
    let ref = group[name];
    return html += `
    <dt id="ref:${name}">${name}</dt>
    <dd>
      <cite><a href="${ref.href}">${ref.title}</a></cite>.
      ${ref.authors.join('; ')}; ${ref.rawDate}. <span class="reference-status">Status: ${ref.status}</span>.
    </dd>
  `;
  }, '<dl class="reference-list">');
  return `\n${html}\n</dl>\n`;
}

/**
 * Finds the KaTeX distribution path.
 * Checks common locations for the KaTeX package.
 * @returns {string} The path to the KaTeX distribution.
 * @throws {Error} If KaTeX distribution cannot be located.
 */
function findKatexDist() {
  const relpath = "node_modules/katex/dist";
  const paths = [
    path.join(process.cwd(), relpath),
    path.join(__dirname, relpath),
  ];
  for (const abspath of paths) {
    if (fs.existsSync(abspath)) {
      return abspath;
    }
  }
  throw new Error("katex distribution could not be located");
}

module.exports = {
  katexRules,
  replacerRegex,
  replacerArgsRegex,
  replacers,
  createScriptElementWithXTrefDataForEmbeddingInHtml,
  lookupXrefTerm,
  applyReplacers,
  normalizePath,
  renderRefGroup,
  findKatexDist
};