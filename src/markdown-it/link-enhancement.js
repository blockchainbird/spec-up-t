'use strict';

/**
 * Markdown-it Link Enhancement Module
 * 
 * This module enhances link rendering by adding path-based attributes to anchor tags.
 * These attributes can be used for CSS styling or JavaScript behavior based on the
 * link's destination (domain, path segments, etc.).
 * 
 * For example, a link to "https://example.com/docs/api" would get attributes like:
 * - path-0="example.com"
 * - path-1="docs"
 * - path-2="api"
 * 
 * This allows for targeted styling of links based on their destination.
 */

/**
 * Regular expression to extract domains and path segments from URLs
 * 
 * This regex has two capture groups:
 * - Group 1: Domain from http(s):// URLs (e.g., "example.com" from "https://example.com/path")
 * - Group 2: Path segments from relative URLs (e.g., "docs" from "/docs/page")
 * 
 * The 'g' flag enables global matching to find all segments in a URL.
 */
const pathSegmentRegex = /(?:http[s]*:\/\/([^\/]*)|(?:\/([^\/?]*)))/g;

/**
 * Applies link enhancements to a markdown-it instance
 * 
 * @param {Object} md - The markdown-it instance to enhance
 * 
 * This function overrides the default link_open and link_close renderers
 * to add path-based attributes and special handling for auto-detected links.
 */
function applyLinkEnhancements(md) {
  
  /**
   * Custom link_open renderer that adds path attributes
   * 
   * @param {Array} tokens - Array of all tokens being processed
   * @param {Number} idx - Index of the current link_open token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} renderer - The renderer instance
   * @returns {String} HTML string for the opening anchor tag with path attributes
   */
  md.renderer.rules.link_open = function (tokens, idx, options, env, renderer) {
    let token = tokens[idx];
    
    // Process all attributes of the link token
    let attrs = token.attrs.reduce((str, attr) => {
      let name = attr[0];   // Attribute name (e.g., 'href', 'title')
      let value = attr[1];  // Attribute value (e.g., 'https://example.com')
      
      // Special processing for href attributes to add path information
      if (name === 'href') {
        let index = 0;
        
        // Extract domain and path segments using the regex
        value.replace(pathSegmentRegex, (match, domain, pathSegment) => {
          // Add path-N attributes for each segment found
          // domain OR pathSegment will be defined (not both, due to regex groups)
          str += `path-${index++}="${domain || pathSegment}" `;
        });
      }
      
      // Add the original attribute to the string
      str += `${name}="${value}" `;
      return str;
    }, '');

    // Create the opening anchor tag with all attributes
    let anchor = `<a ${attrs}>`;
    
    // Special handling for auto-detected links (linkify plugin)
    // These get an extra <span> wrapper for styling purposes
    return token.markup === 'linkify' ? anchor + '<span>' : anchor;
  };

  /**
   * Custom link_close renderer
   * 
   * @param {Array} tokens - Array of all tokens being processed
   * @param {Number} idx - Index of the current link_close token
   * @param {Object} options - Markdown-it options
   * @param {Object} env - Environment/context object
   * @param {Object} renderer - The renderer instance
   * @returns {String} HTML string for the closing anchor tag
   */
  md.renderer.rules.link_close = function (tokens, idx, options, env, renderer) {
    // Close the extra span for linkify links, or just close the anchor
    return tokens[idx].markup === 'linkify' ? '</span></a>' : '</a>';
  };
}

module.exports = applyLinkEnhancements;
