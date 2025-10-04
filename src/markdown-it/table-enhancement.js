'use strict';

/**
 * Markdown-it Table Enhancement Module
 * 
 * This module enhances the default table rendering by:
 * 1. Adding Bootstrap CSS classes for styling (table, table-striped, table-bordered, table-hover)
 * 2. Wrapping tables in a responsive container div for mobile-friendly display
 * 
 * The markdown-it library uses a token-based rendering system where:
 * - Tokens represent different parts of the markdown (table_open, table_close, etc.)
 * - Renderer rules are functions that convert tokens to HTML
 * - We override the default rules to add our custom behavior
 */

/**
 * Applies table enhancements to a markdown-it instance
 * 
 * @param {Object} md - The markdown-it instance to enhance
 * 
 * How this works:
 * - Saves the original table_open and table_close renderers as fallbacks
 * - Overrides them with custom functions that add Bootstrap classes and responsive wrapper
 * - The table_open rule adds classes to the <table> element and opens a wrapper <div>
 * - The table_close rule closes both the </table> and the wrapper </div>
 */
function applyTableEnhancements(md) {
  // Store the original table renderers so we can call them after our modifications
  // If no custom renderer exists, markdown-it provides a default self.renderToken function
  const originalTableRender = md.renderer.rules.table_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  const originalTableCloseRender = md.renderer.rules.table_close || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  /**
   * Custom table_open renderer
   * 
   * @param {Array} tokens - Array of all tokens being processed
   * @param {Number} idx - Index of the current table_open token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} self - The renderer instance
   * @returns {String} HTML string for the opening table with wrapper
   */
  md.renderer.rules.table_open = function (tokens, idx, options, env, self) {
    // Get the current table token to modify its attributes
    const token = tokens[idx];
    
    // Find if the table already has a class attribute
    const classIndex = token.attrIndex('class');
    
    // Define the Bootstrap classes we want to add
    const tableClasses = 'table table-striped table-bordered table-hover';

    if (classIndex < 0) {
      // No existing class attribute - add our classes
      token.attrPush(['class', tableClasses]);
    } else {
      // Class attribute exists - append our classes if they're not already present
      const existingClasses = token.attrs[classIndex][1];
      
      // Filter out classes that are already present to avoid duplicates
      const classesToAdd = tableClasses
        .split(' ')
        .filter(cls => !existingClasses.includes(cls))
        .join(' ');

      // Only append if we have new classes to add
      if (classesToAdd) {
        token.attrs[classIndex][1] = existingClasses + ' ' + classesToAdd;
      }
    }

    // Return the responsive wrapper div + the enhanced table opening tag
    return '<div class="table-responsive-md">' + originalTableRender(tokens, idx, options, env, self);
  };

  /**
   * Custom table_close renderer
   * 
   * @param {Array} tokens - Array of all tokens being processed
   * @param {Number} idx - Index of the current table_close token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} self - The renderer instance
   * @returns {String} HTML string for closing the table and wrapper
   */
  md.renderer.rules.table_close = function (tokens, idx, options, env, self) {
    // Close both the table and the responsive wrapper div
    return originalTableCloseRender(tokens, idx, options, env, self) + '</div>';
  };
}

module.exports = applyTableEnhancements;