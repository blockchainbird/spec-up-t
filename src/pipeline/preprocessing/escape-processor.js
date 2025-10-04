/**
 * Escape handler for substitution tags in Spec-Up
 * Provides mechanism to display literal [[tag]] syntax without processing
 * 
 * Implements a three-phase approach:
 * 1. Pre-processing: Convert escaped sequences to temporary placeholders
 * 2. Tag Processing: Existing substitution logic runs normally (placeholders ignored)
 * 3. Post-processing: Restore escaped sequences as literals
 */

const { escaping } = require('../../utils/regex-patterns.js');

const ESCAPED_PLACEHOLDER = '__SPEC_UP_ESCAPED_TAG__';

/**
 * Pre-processes text to handle escaped substitution tags
 * @param {string} text - Input text with potential escaped tags
 * @returns {string} Text with escaped tags replaced by placeholders
 */
function preProcessEscapes(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Handle double backslash first: \\[[ → \__PLACEHOLDER__
  let processed = text.replace(/\\\\(\[\[)/g, `\\${ESCAPED_PLACEHOLDER}`);
  
  // Handle single backslash: \[[ → __PLACEHOLDER__
  processed = processed.replace(/\\(\[\[)/g, ESCAPED_PLACEHOLDER);
  
  return processed;
}

/**
 * Post-processes text to restore escaped tags as literals
 * @param {string} text - Text after substitution processing
 * @returns {string} Text with placeholders restored to literal tags
 */
function postProcessEscapes(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Restore placeholders to literal [[
  return text.replace(escaping.placeholderRegex, '[[');
}

/**
 * Main processing function that wraps existing substitution logic
 * @param {string} content - Raw markdown content
 * @param {Function} processSubstitutions - Existing substitution processor
 * @returns {string} Processed content with escape handling
 */
function processWithEscapes(content, processSubstitutions) {
  if (!content || typeof content !== 'string') {
    return content;
  }
  
  const preProcessed = preProcessEscapes(content);
  const substituted = processSubstitutions(preProcessed);
  return postProcessEscapes(substituted);
}

module.exports = {
  preProcessEscapes,
  postProcessEscapes,
  processWithEscapes,
  ESCAPED_PLACEHOLDER
};
