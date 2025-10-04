'use strict';

/**
 * Markdown-it Extensions - Legacy Interface
 * 
 * This file provides backward compatibility for the refactored markdown-it extensions.
 * All the complex logic has been moved to specialized modules in the './markdown-it/' directory
 * for better maintainability and understanding.
 * 
 * The modular approach breaks down the functionality into:
 * - Table enhancements (Bootstrap styling, responsive wrappers)
 * - Template-tag syntax processing ([[def:term]], [[tref:spec,term]], etc.)
 * - Link enhancements (path-based attributes)
 * - Definition list processing (terminology vs references, term classification)
 * 
 * This refactoring reduces cognitive complexity and makes the code more approachable
 * for developers who are not familiar with the markdown-it library.
 */

// Import the new modular markdown-it extensions
const applyMarkdownItExtensions = require('../../markdown-it');

/**
 * Legacy interface function that maintains compatibility with existing code
 * 
 * @param {Object} md - The markdown-it instance to enhance
 * @param {Array} templates - Array of template-tag handler objects for custom syntax
 * 
 * This function simply delegates to the new modular system while maintaining
 * the same interface that consuming code expects.
 */
module.exports = function (md, templates = []) {
  // Apply all markdown-it enhancements using the new modular system
  applyMarkdownItExtensions(md, templates);
};
