  /**
 * Specification Parser - Functional Style
 * 
 * This module provides pure functions for processing specification-related markdown extensions:
 * - [[spec: name]] - Individual specification references
 * - [[spec-*: name]] - Grouped specification references (e.g., spec-normative, spec-informative)
 * 
 * The functional approach isolates specification logic from terminology concerns,
 * reducing cognitive complexity and improving maintainability through pure functions.
 */

const { renderRefGroup } = require('../pipeline/rendering/render-utils.js');
const { whitespace } = require('../utils/regex-patterns');

/**
 * Normalizes a specification name for consistent lookup
 * @param {string} name - The original specification name
 * @returns {string} The normalized name (uppercase with hyphens)
 */
function normalizeSpecName(name) {
  return name.replace(whitespace.oneOrMore, '-').toUpperCase();
}

/**
 * Looks up a specification in the corpus using various name formats
 * @param {Object} specCorpus - The specification corpus
 * @param {string} name - The specification name to look up
 * @returns {Object|null} The found specification or null
 */
function findSpecInCorpus(specCorpus, name) {
  const normalizedName = normalizeSpecName(name);
  
  return specCorpus[normalizedName] ||
    specCorpus[normalizedName.toLowerCase()] ||
    specCorpus[name.toLowerCase()] ||
    specCorpus[name] ||
    null;
}

/**
 * Processes specification reference tokens during parsing phase
 * Looks up specification details and stores them for later rendering
 * @param {Object} specCorpus - The loaded specification corpus
 * @param {Object} globalState - Global state object containing specGroups
 * @param {Object} token - The markdown-it token being processed
 * @param {string} type - The type of spec construct (e.g., 'spec', 'spec-normative')
 * @param {string} name - The specification name to look up
 */
function parseSpecReference(specCorpus, globalState, token, type, name) {
  if (!name) return;

  const spec = findSpecInCorpus(specCorpus, name);

  if (spec) {
    // Store the normalized name for consistent referencing
    const normalizedName = normalizeSpecName(name);
    spec._name = normalizedName;

    // Organize specifications by type/group for rendering
    const group = globalState.specGroups[type] = globalState.specGroups[type] || {};
    token.info.spec = group[normalizedName] = spec;
  }
}

/**
 * Renders an individual specification reference as a link
 * @param {Object} token - The token containing spec information
 * @returns {string} HTML anchor element linking to the specification
 */
function renderIndividualSpec(token) {
  const spec = token.info.spec;
  if (!spec) return '';

  // Create a reference link to the specification
  // The href uses a 'ref:' prefix to distinguish from term references
  return `[<a class="spec-reference" href="#ref:${spec._name}">${spec._name}</a>]`;
}

/**
 * Renders a group of specifications as a formatted list
 * @param {string} type - The specification group type
 * @param {Object} specGroups - The global specGroups object
 * @returns {string} HTML representation of the specification group
 */
function renderSpecGroup(type, specGroups) {
  // Delegate to the render utility which handles the complex group formatting
  return renderRefGroup(type, specGroups);
}

/**
 * Renders specification references during the rendering phase
 * Creates either individual spec links or grouped spec lists
 * @param {Object} specGroups - The global specGroups object
 * @param {Object} token - The markdown-it token being rendered
 * @param {string} type - The type of spec construct
 * @param {string} name - The specification name (if individual reference)
 * @returns {string} HTML for the specification reference or group
 */
function renderSpecReference(specGroups, token, type, name) {
  if (name) {
    // Render individual specification reference
    return renderIndividualSpec(token);
  } else {
    // Render grouped specification references (when no specific name is provided)
    return renderSpecGroup(type, specGroups);
  }
}

/**
 * Gets all specifications in a specific group
 * Utility function for accessing grouped specifications
 * @param {Object} specGroups - The global specGroups object
 * @param {string} type - The specification group type
 * @returns {Object} Object containing all specs in the group
 */
function getSpecGroup(specGroups, type) {
  return specGroups[type] || {};
}

/**
 * Checks if a specification exists in the corpus
 * @param {Object} specCorpus - The specification corpus
 * @param {string} name - The specification name to check
 * @returns {boolean} True if the specification exists
 */
function hasSpec(specCorpus, name) {
  return findSpecInCorpus(specCorpus, name) !== null;
}

/**
 * Creates a specification parser function with bound corpus and global state.
 * This provides a clean interface similar to the class-based approach but with functional benefits.
 * @param {Object} specCorpus - The specification corpus
 * @param {Object} globalState - Global state object
 * @returns {Object} An object with parser and renderer functions
 */
function createSpecParser(specCorpus, globalState) {
  return {
    parseSpecReference: (token, type, name) => parseSpecReference(specCorpus, globalState, token, type, name),
    renderSpecReference: (token, type, name) => renderSpecReference(globalState.specGroups, token, type, name),
    hasSpec: (name) => hasSpec(specCorpus, name),
    getSpecGroup: (type) => getSpecGroup(globalState.specGroups, type)
  };
}

module.exports = {
  createSpecParser,
  // Export individual functions for testing purposes  
  parseSpecReference,
  renderIndividualSpec,
  hasSpec
};