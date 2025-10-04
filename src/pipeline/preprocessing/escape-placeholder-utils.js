/**
 * Escape Mechanism Module for Spec-Up Substitution Tags
 * 
 * This module provides functions to handle backslash escape sequences for substitution tags,
 * allowing users to display tag syntax literally in their documentation.
 * 
 * The escape mechanism works in three phases:
 * 1. Pre-processing: Convert escaped sequences to temporary placeholders
 * 2. Tag processing: Normal substitution logic (handled elsewhere)
 * 3. Post-processing: Restore escaped sequences as literals
 * 
 * Supported escape pattern:
 * - \[[tag: content]] → displays as literal [[tag: content]]
 * 
 * @version 1.0.0
 */

/**
 * Handles backslash escape mechanism for substitution tags
 * 
 * Use backslash escape sequences to allow literal [[ tags in markdown
 * 
 * Phase 1: Pre-processing - Convert escaped sequences to temporary placeholders
 * 
 * @param {string} doc - The markdown document to process
 * @returns {string} - Document with escaped sequences converted to placeholders
 */
function processEscapedTags(doc) {
  // Replace \[[ with escape placeholder for literal display
  // In markdown: \[[def: term]] should become [[def: term]] (literal tag syntax)
  doc = doc.replace(/\\(\[\[)/g, '__SPEC_UP_ESCAPED_TAG__');
  
  return doc;
}

/**
 * Handles backslash escape mechanism for substitution tags
 * 
 * Use backslash escape sequences to allow literal [[ tags in markdown
 * 
 * Phase 3: Post-processing - Restore escaped sequences as literals
 * Converts placeholders back to literal [[ characters
 * 
 * @param {string} renderedHtml - The rendered HTML to process
 * @returns {string} - HTML with placeholders restored to literal [[ tags
 */
function restoreEscapedTags(renderedHtml) {
  // Replace escaped tag placeholders with literal [[ 
  renderedHtml = renderedHtml.replace(/__SPEC_UP_ESCAPED_TAG__/g, '[[');
  
  return renderedHtml;
}

module.exports = {
  processEscapedTags,
  restoreEscapedTags
};
