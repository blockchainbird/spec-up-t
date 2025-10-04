/**
 * Template Tag Parser - Functional Style
 * 
 * This module provides pure functions for processing template-tag markdown extensions:
 * - [[def: term, alias]] - Term definitions with optional aliases
 * - [[ref: term]] - Internal term references
 * - [[xref: spec, term]] - External specification term references
 * - [[tref: spec, term, alias1, alias2, ...]] - External term references with multiple aliases
 * 
 * The functional approach reduces cognitive complexity and makes functions easier to test
 * as they are pure functions with clear inputs and outputs.
 */

const { findExternalSpecByKey } = require('../pipeline/references/external-references-service.js');
const { lookupXrefTerm } = require('../pipeline/rendering/render-utils.js');
const { whitespace, htmlComments, contentCleaning, externalReferences } = require('../utils/regex-patterns');

/**
 * Extracts the current file from token content for source tracking
 * @param {Object} token - The markdown-it token
 * @param {Object} globalState - Global state containing fallback currentFile
 * @returns {string} The source file name
 */
function extractCurrentFile(token, globalState) {
  const content = token.map ? token.map[0] : '';
  const fileMatch = content && content.match && content.match(htmlComments.fileTracker);
  return fileMatch ? fileMatch[1] : globalState.currentFile || 'unknown';
}

/**
 * Main parsing entry point for template-tag constructs
 * @param {Object} config - Configuration object containing specs and settings
 * @param {Object} globalState - Global state object containing definitions, references, etc.
 * @param {Object} token - The markdown-it token being processed
 * @param {string} type - The type of construct (def, ref, xref, tref)
 * @param {string} primary - The primary content/term
 * @returns {string} The rendered HTML for the construct
 */
function parseTemplateTag(config, globalState, token, type, primary) {
  if (!primary) return;

  const currentFile = extractCurrentFile(token, globalState);

  switch (type) {
    case 'def':
      return parseDef(globalState, token, primary, currentFile);
    case 'xref':
      return parseXref(config, token);
    case 'tref':
      return parseTref(token);
    default:
      return parseRef(globalState, primary);
  }
}

/**
 * Processes [[def: term, alias1, alias2, ...]] constructs
 * Creates definition entries and generates HTML spans with proper IDs
 * Format: "Primary Alias (alias2, alias3, original-term)" similar to tref
 * @param {Object} globalState - Global state to store definitions
 * @param {Object} token - The markdown-it token
 * @param {string} primary - The primary term content
 * @param {string} currentFile - The source file containing this definition
 * @returns {string} HTML span elements with term IDs
 */
function parseDef(globalState, token, primary, currentFile) {
  const termName = token.info.args[0];
  const aliases = token.info.args.slice(1).filter(Boolean); // Get all aliases after the term

  // Store definition in global state for validation and cross-referencing
  globalState.definitions.push({
    term: termName,
    alias: aliases[0] || null, // First alias, or null if no aliases
    source: currentFile
  });

  // Determine the primary display term (first alias if available, otherwise original term)
  const primaryDisplayTerm = aliases.length > 0 ? aliases[0] : termName;

  // Build the display text format: "Primary (alias1, alias2, original-term)"
  let displayText = primaryDisplayTerm;

  if (aliases.length > 0) {
    // Collect all additional terms to show in parentheses
    const parentheticalContent = [];

    // Add remaining aliases (after the first one used as primary)
    if (aliases.length > 1) {
      parentheticalContent.push(...aliases.slice(1));
    }

    // Add original term if it's different from the primary display term
    if (termName !== primaryDisplayTerm) {
      parentheticalContent.push(`<span class='term-local-original-term' title='original term'>${termName}</span>`);
    }

    // Append parenthetical terms if any exist
    if (parentheticalContent.length > 0) {
      displayText += ` <span class='term-local-parenthetical-terms'>(${parentheticalContent.join(', ')})</span>`;
    }
  }

  // Generate HTML spans for each term/alias combination
  // This creates anchor points that can be referenced by links
  // IDs stay intact - we create an ID for the original term and each alias
  return token.info.args.reduce((acc, syn) => {
    // Generate a unique term ID by normalizing the synonym: replace whitespace with hyphens and convert to lowercase. The ID is used for fragment identifier (hash) in the URL, which in turn can be used for an anchor in a web page.
    const termId = `term:${syn.replace(whitespace.oneOrMore, '-').toLowerCase()}`;
    return `<span id="${termId}">${acc}</span>`;
  }, displayText);
}

/**
 * Processes [[ref: term]] constructs
 * Creates internal links to locally defined terms
 * @param {Object} globalState - Global state to track references
 * @param {string} primary - The term to reference
 * @returns {string} HTML anchor element linking to local term
 */
function parseRef(globalState, primary) {
  // Track this reference for validation purposes
  globalState.references.push(primary);

  // Create internal link to the term definition
  const termId = primary.replace(whitespace.oneOrMore, '-').toLowerCase();
  return `<a class="term-reference" href="#term:${termId}">${primary}</a>`;
}

/**
 * Processes [[xref: spec, term, alias, ...]] constructs
 * Creates links to external specification terms with tooltips
 * Uses primaryDisplayTerm concept: shows first alias if available, otherwise shows the term itself
 * @param {Object} config - Configuration containing external specs
 * @param {Object} token - The markdown-it token
 * @returns {string} HTML anchor element linking to external term
 */
function parseXref(config, token) {
  const externalSpec = findExternalSpecByKey(config, token.info.args[0]);
  const url = externalSpec?.gh_page || '#';
  const termName = token.info.args[1];
  const aliases = token.info.args.slice(2).filter(Boolean); // Get all aliases after the term
  const term = termName.replace(whitespace.oneOrMore, '-').toLowerCase();
  const xrefTerm = lookupXrefTerm(token.info.args[0], term);

  // Determine the primary display term (first alias if available, otherwise original term)
  const primaryDisplayTerm = aliases.length > 0 ? aliases[0] : termName;

  // Build link attributes with both local and external href capabilities
  let linkAttributes = `class="x-term-reference term-reference" data-local-href="#term:${token.info.args[0]}:${term}" href="${url}#term:${term}"`;

  // Add tooltip content if term definition is available
  if (xrefTerm && xrefTerm.content) {
    const cleanContent = xrefTerm.content.replace(contentCleaning.quotes, '&quot;').replace(contentCleaning.newlines, ' ');
    linkAttributes += ` title="External term definition" data-term-content="${cleanContent}"`;
  }

  return `<a ${linkAttributes}>${primaryDisplayTerm}</a>`;
}

/**
 * Processes [[tref: spec, term, alias, ...]] constructs
 * Creates external term references with multiple aliases displayed in a readable format
 * Format: "Primary Alias (alias1, alias2, original-term)"
 * @param {Object} token - The markdown-it token
 * @returns {string} HTML span element for external term reference
 */
function parseTref(token) {
  const termName = token.info.args[1];
  const aliases = token.info.args.slice(2).filter(Boolean); // Get all aliases after the term

  // Determine the primary display term (first alias if available, otherwise original term)
  const primaryDisplayTerm = aliases.length > 0 ? aliases[0] : termName;

  // Build the display text format: "Primary (alias1, alias2, original-term)"
  let displayText = primaryDisplayTerm;

  if (aliases.length > 0) {
    // Collect all additional terms to show in parentheses
    const parentheticalContent = [];

    // Add remaining aliases (after the first one used as primary)
    if (aliases.length > 1) {
      parentheticalContent.push(...aliases.slice(1));
    }

    // Add original term if it's different from the primary display term
    if (termName !== primaryDisplayTerm) {
      parentheticalContent.push(`<span class='term-external-original-term' title='original term'>${termName}</span>`);
    }

    // Append parenthetical terms if any exist
    if (parentheticalContent.length > 0) {
      displayText += ` <span class='term-external-parenthetical-terms'>(${parentheticalContent.join(', ')})</span>`;
    }
  }

  const termId = `term:${termName.replace(whitespace.oneOrMore, '-').toLowerCase()}`;
  const primaryAliasId = aliases.length > 0 ? `term:${aliases[0].replace(whitespace.oneOrMore, '-').toLowerCase()}` : '';

  // Handle cases where we have aliases
  if (aliases.length > 0 && aliases[0] !== termName) {
    return `<span data-original-term="${termName}" class="term-external" id="${termId}"><span title="Externally defined as ${termName}" id="${primaryAliasId}">${displayText}</span></span>`;
  } else {
    return `<span title="Externally also defined as ${termName}" data-original-term="${termName}" class="term-external" id="${termId}">${displayText}</span>`;
  }
}

/**
 * Parses an `[[xref:...]]` or `[[tref:...]]` string into a structured object.
 * This function was moved from xtref-utils.js to consolidate parsing logic
 * and prevent cross-module object mutation.
 *
 * @param {string} xtref - Raw reference markup including brackets and prefix.
 * @returns {{ externalSpec: string, term: string, referenceType: string, firstAlias?: string, aliases: string[] }}
 */
function processXTrefObject(xtref) {
  const referenceTypeMatch = xtref.match(externalReferences.referenceType);
  const referenceType = referenceTypeMatch ? referenceTypeMatch[1] : 'unknown';

  const parts = xtref
    .replace(externalReferences.openingTag, '')
    .replace(externalReferences.closingTag, '')
    .trim()
    .split(externalReferences.argsSeparator);

  const xtrefObject = {
    externalSpec: parts[0].trim(),
    term: parts[1].trim(),
    referenceType
  };

  // Collect all aliases from parts after the term (index 1), trim and filter empties
  const allAliases = parts.slice(2).map(p => p.trim()).filter(Boolean);
  
  // Initialize both tref and xref alias arrays
  xtrefObject.trefAliases = [];
  xtrefObject.xrefAliases = [];

  // Store aliases in the appropriate array based on reference type
  if (referenceType === 'tref') {
    xtrefObject.trefAliases = allAliases;
    // Store the first tref alias separately as it has special meaning
    if (allAliases.length > 0) {
      xtrefObject.firstTrefAlias = allAliases[0];
    }
  } else if (referenceType === 'xref') {
    xtrefObject.xrefAliases = allAliases;
    // Store the first xref alias separately as it has special meaning
    if (allAliases.length > 0) {
      xtrefObject.firstXrefAlias = allAliases[0];
    }
  }

  return xtrefObject;
}

/**
 * Creates a template-tag parser function with bound configuration and global state.
 * This provides a clean interface similar to the class-based approach but with functional benefits.
 * @param {Object} config - Configuration object
 * @param {Object} globalState - Global state object
 * @returns {Function} A parser function that can be called with (token, type, primary)
 */
function createTemplateTagParser(config, globalState) {
  return (token, type, primary) => parseTemplateTag(config, globalState, token, type, primary);
}

module.exports = {
  createTemplateTagParser,
  // Export individual functions for testing purposes
  parseDef,
  parseXref,
  parseTref,
  parseRef,
  parseTemplateTag,
  processXTrefObject
};