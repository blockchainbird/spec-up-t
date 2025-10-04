/**
 * Parsers Module Index - Functional Style
 * 
 * This module provides a centralized export point for all parser functions.
 * It promotes clean imports and consistent API access across the codebase.
 * The functional approach provides better tree-shaking and simpler testing.
 */

const templateTagParser = require('./template-tag-parser');
const specParser = require('./spec-parser');

module.exports = {
  // Parser factory functions
  createTemplateTagParser: templateTagParser.createTemplateTagParser,
  createSpecParser: specParser.createSpecParser
};