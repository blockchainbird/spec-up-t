'use strict';

/**
 * Markdown-it Extensions Module Orchestrator
 * 
 * This module serves as the main entry point for all markdown-it enhancements
 * used in the spec-up system. It provides a clean interface to apply all
 * custom rendering rules and functionality to a markdown-it instance.
 * 
 * The module is organized into focused sub-modules, each handling a specific
 * aspect of markdown processing:
 * 
 * - TABLE ENHANCEMENT: Bootstrap styling and responsive wrappers
 * - TEMPLATE-TAG SYNTAX: Custom [[template-tag:args]] syntax processing
 * - LINK ENHANCEMENT: Path-based attributes for links
 * - DEFINITION LISTS: Advanced terminology and reference list handling
 * 
 * This modular approach makes the code more maintainable and easier to
 * understand for developers unfamiliar with the markdown-it library.
 */

// Import all the specialized enhancement modules
const applyTableEnhancements = require('./table-enhancement');
const applyTemplateTagSyntax = require('./template-tag-syntax');
const applyLinkEnhancements = require('./link-enhancement');
const applyDefinitionListEnhancements = require('./definition-lists');

/**
 * Applies all markdown-it enhancements to a markdown-it instance
 * 
 * This is the main function that consuming code should call. It orchestrates
 * the application of all enhancement modules in the correct order.
 * 
 * @param {Object} md - The markdown-it instance to enhance
 * @param {Array} templates - Array of template-tag handler objects for custom syntax
 *                            Each template-tag handler should have:
 *                            - filter(type): function returning true if handler processes this type
 *                            - parse(token, type, ...args): optional preprocessing function
 *                            - render(token, type, ...args): function returning HTML string
 * 
 * @example
 * const MarkdownIt = require('markdown-it');
 * const applyMarkdownItExtensions = require('./markdown-it');
 * 
 * const md = new MarkdownIt();
 * const templates = [
 *   {
 *     filter: type => type === 'def',
 *     render: (token, type, term) => `<span id="term:${term}">${term}</span>`
 *   }
 * ];
 * 
 * applyMarkdownItExtensions(md, templates);
 * const html = md.render('[[def:example-term]]');
 */
function applyMarkdownItExtensions(md, templates = []) {
  
  // Apply enhancements in order of dependency
  // Some modules may depend on others being applied first
  
  // 1. Table enhancements - independent, can be applied first
  applyTableEnhancements(md);
  
  // 2. Template-tag syntax - should be applied early as other modules may depend on it
  applyTemplateTagSyntax(md, templates);
  
  // 3. Link enhancements - independent, can be applied anytime
  applyLinkEnhancements(md);
  
  // 4. Definition lists - depends on template-tag syntax for term type detection
  applyDefinitionListEnhancements(md);
  
  // The markdown-it instance is now fully enhanced and ready for use
}

// Export the main orchestrator function
module.exports = applyMarkdownItExtensions;

// Also export individual modules for fine-grained control if needed
module.exports.tableEnhancements = applyTableEnhancements;
module.exports.templateTagSyntax = applyTemplateTagSyntax;
module.exports.linkEnhancements = applyLinkEnhancements;
module.exports.definitionLists = applyDefinitionListEnhancements;
