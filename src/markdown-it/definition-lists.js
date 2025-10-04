'use strict';

const { htmlComments } = require('../utils/regex-patterns');

/**
 * Markdown-it Definition Lists Enhancement Module
 * 
 * This module provides sophisticated enhancements for definition lists (<dl>) in markdown.
 * It handles several key aspects of definition list processing in the spec-up system:
 * 
 * 1. TERMINOLOGY CLASSIFICATION: Distinguishes between different types of definition lists:
 *    - Terms and definitions lists (terminology sections)
 *    - Specification reference lists (bibliographic references)
 * 
 * 2. TERM TYPE DETECTION: Identifies and styles different types of terms:
 *    - Local terms (defined with [[def:term]]) - get 'term-local' class
 *    - External terms (referenced with [[tref:spec,term]]) - get 'term-external' class
 *    - Regular terms (no special class)
 * 
 * 3. QUALITY CONTROL: Handles problematic definition list structures:
 *    - Empty <dt> elements (removes them entirely)
 *    - Proper class assignment to avoid conflicts
 * 
 * 4. SECTION DETECTION: Uses markers to identify terminology sections and apply
 *    appropriate styling only where needed.
 * 
 * This module is central to the spec-up system's terminology management capabilities.
 */

/**
 * Applies definition list enhancements to a markdown-it instance
 * 
 * @param {Object} md - The markdown-it instance to enhance
 * 
 * This function sets up custom renderers for definition list elements (dl_open, dt_open, dt_close)
 * that provide intelligent classification and styling based on content analysis.
 */
function applyDefinitionListEnhancements(md) {
  
  // Store original renderers for fallback behavior
  const originalDlRender = md.renderer.rules.dl_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  
  const originalDtRender = md.renderer.rules.dt_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  
  const originalDtCloseRender = md.renderer.rules.dt_close || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // State tracking: ensures we only add the terminology class once per document
  let classAdded = false;

  // ===================================================================================
  // HELPER FUNCTIONS FOR TOKEN ANALYSIS
  // ===================================================================================

  /**
   * Locates a specific HTML marker in the token stream
   * 
   * This is used to find the "terminology-section-start" marker that indicates
   * where terminology definitions begin in the document. Only definition lists
   * that appear after this marker should be styled as terminology lists.
   * 
   * @param {Array} tokens - The complete token array for the document
   * @param {String} targetHtml - The HTML string to search for (e.g., 'terminology-section-start')
   * @returns {Number} Index of the token containing the target HTML, or -1 if not found
   */
  function findTargetIndex(tokens, targetHtml) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].content && tokens[i].content.includes(targetHtml)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Identifies and marks empty definition term elements for removal
   * 
   * Empty <dt> elements (where dt_open is immediately followed by dt_close with no content)
   * cause rendering and styling problems. This function marks them with an 'isEmpty' flag
   * so they can be skipped during the rendering phase.
   * 
   * @param {Array} tokens - The token array to analyze
   * @param {Number} startIdx - Index to start searching from (typically after dl_open)
   */
  function markEmptyDtElements(tokens, startIdx) {
    for (let i = startIdx; i < tokens.length; i++) {
      // Stop when we reach the end of this definition list
      if (tokens[i].type === 'dl_close') {
        break;
      }

      // Check for the empty dt pattern: dt_open immediately followed by dt_close
      if (tokens[i].type === 'dt_open' &&
          i + 1 < tokens.length &&
          tokens[i + 1].type === 'dt_close') {
        
        // Mark both tokens for removal during rendering
        tokens[i].isEmpty = true;
        tokens[i + 1].isEmpty = true;
      }
    }
  }

  /**
   * Placeholder for future last dd element processing
   * 
   * This function was mentioned in the original code but not implemented.
   * It could be used to identify the last <dd> in each dt/dd group for special styling.
   * 
   * @param {Array} tokens - The token array to process
   * @param {Number} startIdx - Index to start processing from
   */
  function processLastDdElements(tokens, startIdx) {
    let lastDdIndex = -1; // Tracks the most recent dd_open token
    // TODO: Implement if needed for future enhancements
  }

  // ===================================================================================
  // SPEC REFERENCE DETECTION FUNCTIONS
  // ===================================================================================

  /**
   * Determines if a definition list contains specification references
   * 
   * Specification references are identified by dt elements with id attributes
   * starting with "ref:" (e.g., id="ref:RFC2119"). These should NOT be styled
   * as terminology lists since they serve a different purpose (bibliography).
   * 
   * @param {Array} tokens - Token array to search through
   * @param {Number} startIdx - Index to start searching from (after dl_open)
   * @returns {Boolean} True if the dl contains spec references, false otherwise
   */
  function containsSpecReferences(tokens, startIdx) {
    for (let i = startIdx; i < tokens.length; i++) {
      if (tokens[i].type === 'dl_close') {
        break; // End of this definition list
      }
      
      // Check all three ways spec references can appear
      if (isDtRef(tokens[i]) || isHtmlRef(tokens[i]) || isInlineRef(tokens[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a dt_open token has a spec reference id attribute
   * 
   * @param {Object} token - The token to check
   * @returns {Boolean} True if token has id starting with "ref:"
   */
  function isDtRef(token) {
    if (token.type !== 'dt_open' || !token.attrs) return false;
    return token.attrs.some(attr => attr[0] === 'id' && attr[1].startsWith('ref:'));
  }

  /**
   * Checks if an HTML token contains a spec reference id
   * 
   * @param {Object} token - The token to check
   * @returns {Boolean} True if HTML content contains id="ref:..."
   */
  function isHtmlRef(token) {
    if (token.type !== 'html_block' && token.type !== 'html_inline') return false;
    return token.content && token.content.includes('id="ref:');
  }

  /**
   * Checks if an inline token contains a spec reference id
   * 
   * @param {Object} token - The token to check
   * @returns {Boolean} True if inline content contains id="ref:..."
   */
  function isInlineRef(token) {
    if (token.type !== 'inline') return false;
    return token.content && token.content.includes('id="ref:');
  }

  // ===================================================================================
  // TERM TYPE DETECTION FUNCTIONS
  // ===================================================================================

  /**
   * Determines if a definition term is transcluded from an external source
   * 
   * Transcluded terms are created using [[tref:external-spec,term]] syntax.
   * These terms are defined in other specifications and referenced here.
   * They get the 'term-external' CSS class for distinctive styling.
   * 
   * @param {Array} tokens - Token array to analyze
   * @param {Number} dtOpenIndex - Index of the dt_open token to check
   * @returns {Boolean} True if the term is transcluded (external), false otherwise
   */
  function isTermTranscluded(tokens, dtOpenIndex) {
    // Search within this definition term only
    for (let i = dtOpenIndex + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'dt_close') {
        break; // End of this definition term
      }

      // Look for inline content with template tokens
      if (tokens[i].type === 'inline' && tokens[i].children) {
        for (let child of tokens[i].children) {
          // Check if this is a tref (transcluded reference) template
          if (child.type === 'template' &&
              child.info &&
              child.info.type === 'tref') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Determines if a definition term is a local term definition
   * 
   * Local terms are created using [[def:term,alias]] syntax.
   * These are terms defined within the current specification.
   * They get the 'term-local' CSS class for distinctive styling.
   * 
   * @param {Array} tokens - Token array to analyze
   * @param {Number} dtOpenIndex - Index of the dt_open token to check
   * @returns {Boolean} True if the term is a local definition, false otherwise
   */
  function isLocalTerm(tokens, dtOpenIndex) {
    // Search within this definition term only
    for (let i = dtOpenIndex + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'dt_close') {
        break; // End of this definition term
      }

      // Look for inline content with template tokens
      if (tokens[i].type === 'inline' && tokens[i].children) {
        for (let child of tokens[i].children) {
          // Check if this is a def (definition) template
          if (child.type === 'template' &&
              child.info &&
              child.info.type === 'def') {
            return true;
          }
        }
      }
    }
    return false;
  }

  // ===================================================================================
  // CUSTOM RENDERERS
  // ===================================================================================

  /**
   * Custom renderer for definition list opening tags (<dl>)
   * 
   * This renderer implements intelligent classification of definition lists:
   * 
   * 1. Finds the terminology section marker in the document
   * 2. Checks if this dl already has styling (to avoid conflicts)
   * 3. Determines if this dl contains spec references (bibliography vs terminology)
   * 4. Adds 'terms-and-definitions-list' class only to appropriate terminology lists
   * 5. Processes empty dt elements and last dd elements
   * 
   * @param {Array} tokens - Complete token array
   * @param {Number} idx - Index of current dl_open token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} self - Renderer instance
   * @returns {String} HTML for the opening <dl> tag
   */
  md.renderer.rules.dl_open = function (tokens, idx, options, env, self) {
    const targetHtml = 'terminology-section-start';
    let targetIndex = findTargetIndex(tokens, targetHtml);

    // Check if this dl already has a class attribute (e.g., 'reference-list')
    const existingClassIndex = tokens[idx].attrIndex('class');
    const hasExistingClass = existingClassIndex >= 0;

    // Check if this dl contains specification references
    const hasSpecReferences = containsSpecReferences(tokens, idx + 1);

    // Apply terminology list styling only if ALL conditions are met:
    // 1. We found the terminology section marker
    // 2. This dl appears after the marker
    // 3. We haven't already added the class to a previous dl
    // 4. This dl doesn't already have a class (preserves reference-list, etc.)
    // 5. This dl doesn't contain spec references (avoids bibliography confusion)
    if (targetIndex !== -1 && 
        idx > targetIndex && 
        !classAdded && 
        !hasExistingClass && 
        !hasSpecReferences) {
      tokens[idx].attrPush(['class', 'terms-and-definitions-list']);
      classAdded = true;
    }

    // Pre-process this definition list to handle problematic structures
    markEmptyDtElements(tokens, idx + 1);
    processLastDdElements(tokens, idx + 1);

    return originalDlRender(tokens, idx, options, env, self);
  };

  /**
   * Custom renderer for definition term opening tags (<dt>)
   * 
   * This renderer handles:
   * 1. Skipping empty dt elements (marked during dl_open processing)
   * 2. Adding 'term-external' class to transcluded terms (from [[tref:...]])
   * 3. Adding 'term-local' class to local definitions (from [[def:...]])
   * 4. Leaving regular terms without special classes
   * 
   * @param {Array} tokens - Complete token array
   * @param {Number} idx - Index of current dt_open token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} self - Renderer instance
   * @returns {String} HTML for the opening <dt> tag, or empty string if skipped
   */
  md.renderer.rules.dt_open = function (tokens, idx, options, env, self) {
    // Skip rendering empty dt elements that were marked during preprocessing
    if (tokens[idx].isEmpty) {
      return '';
    }

    // Look for the most recent file comment before this dt element
    let sourceFile = null;
    
    // Search backwards through all tokens to find the most recent HTML comment with file info
    for (let i = idx - 1; i >= 0; i--) {
      if (tokens[i].type === 'html_block' && tokens[i].content) {
        const fileMatch = tokens[i].content.match(htmlComments.fileTracker);
        if (fileMatch) {
          sourceFile = fileMatch[1];
          break; // Use the most recent file comment
        }
      }
    }

    // Add data-sourcefile attribute to the dt element if source file was found
    if (sourceFile) {
      tokens[idx].attrPush(['data-sourcefile', sourceFile]);
    }

    // Determine term type and add appropriate CSS class
    if (isTermTranscluded(tokens, idx)) {
      // External/transcluded term - add or append 'term-external' class
      const classIndex = tokens[idx].attrIndex('class');
      if (classIndex < 0) {
        tokens[idx].attrPush(['class', 'term-external']);
      } else {
        tokens[idx].attrs[classIndex][1] += ' term-external';
      }
    } else if (isLocalTerm(tokens, idx)) {
      // Local definition - add or append 'term-local' class
      const classIndex = tokens[idx].attrIndex('class');
      if (classIndex < 0) {
        tokens[idx].attrPush(['class', 'term-local']);
      } else {
        tokens[idx].attrs[classIndex][1] += ' term-local';
      }
    }
    // Regular terms get no special class

    return originalDtRender(tokens, idx, options, env, self);
  };

  /**
   * Custom renderer for definition term closing tags (</dt>)
   * 
   * This renderer ensures that empty dt elements are completely omitted
   * from the final HTML output by skipping their closing tags as well.
   * 
   * @param {Array} tokens - Complete token array
   * @param {Number} idx - Index of current dt_close token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} self - Renderer instance
   * @returns {String} HTML for the closing </dt> tag, or empty string if skipped
   */
  md.renderer.rules.dt_close = function (tokens, idx, options, env, self) {
    // Skip rendering the closing tag for empty dt elements
    // This completes the removal of problematic empty dt structures
    if (tokens[idx].isEmpty) {
      return '';
    }
    return originalDtCloseRender(tokens, idx, options, env, self);
  };
}

module.exports = applyDefinitionListEnhancements;
