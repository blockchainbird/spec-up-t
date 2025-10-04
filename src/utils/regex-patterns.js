/**
 * @fileoverview Centralized regular expressions for the spec-up-t project
 * 
 * This module contains all regular expressions used throughout the spec-up-t codebase,
 * organized by functional category. Centralizing regexes improves maintainability,
 * ensures consistency, and reduces duplication.
 * 
 * Each regex is documented with:
 * - Purpose and usage context
 * - Example matches
 * - Flags used and their meaning
 * - Related regexes in the same category
 * 
 * @author spec-up-t contributors
 * @since 1.3.2
 */

/**
 * Regular expressions for parsing template tag syntax like [[type:args]]
 * Used primarily in markdown-it plugins and content processing
 */
const templateTags = {
  /**
   * Matches template tag syntax [[type:args]] with optional arguments
   * 
   * Groups:
   * - Group 1: tag type (e.g., 'ref', 'tref', 'def', 'insert')
   * - Group 2: arguments (everything after colon, comma-separated)
   * 
   * Examples:
   * - [[def:term1,term2]] → type: 'def', args: 'term1,term2'
   * - [[tref:spec,term]] → type: 'tref', args: 'spec,term'
   * - [[insert:path/file]] → type: 'insert', args: 'path/file'
   * 
   * Flags:
   * - i: case-insensitive matching
   * - m: multiline mode (^ and $ match line boundaries)
   * - g: global matching (find all occurrences)
   */
  replacer: /\[\[\s*([^\s[\]:]+):?\s*([^\]\n]+)?\]\]/img,

  /**
   * Splits arguments within template tags by commas and optional whitespace
   * 
   * Used to parse comma-separated arguments in template tags
   * 
   * Examples:
   * - "arg1, arg2, arg3" → ['arg1', 'arg2', 'arg3']
   * - "spec,term,alias" → ['spec', 'term', 'alias']
   */
  argsSeparator: /\s*,+\s*/,

  /**
   * Template tag content pattern for parsing the inner content of spec-up tags
   * Used in markdown-it template-tag-syntax plugin
   * 
   * Examples:
   * - "def:term1,term2" → type: 'def', args: 'term1,term2'
   * - "tref: spec, term" → type: 'tref', args: ' spec, term'
   * 
   * Flags:
   * - i: case-insensitive matching
   */
  content: /\s*([^\s\[\]:]+):?\s*([^\]\n]+)?/i,

  /**
   * Template variable interpolation pattern for processing ${variable} syntax
  * Used in render-spec-document.js for injecting dynamic values into templates
   * 
   * Pattern breakdown:
   * - \${ → Literal ${
   * - (.*?) → Capture group 1: variable name (non-greedy)
   * - } → Literal }
   * 
   * Examples:
   * - "${title}" → variable: 'title'
   * - "${currentDate}" → variable: 'currentDate'
   * - "${spec.version}" → variable: 'spec.version'
   * 
   * Flags:
   * - g: global to replace all variables in template
   */
  variableInterpolation: /\${(.*?)}/g,

  /**
   * Matches specification name patterns for markdown-it extension filtering
   * Used to determine which markdown-it extension should handle spec references
   * 
   * Pattern breakdown:
   * - ^spec$ → Exact match for "spec"
   * - | → OR operator
   * - ^spec-*\w+$ → "spec" followed by optional dashes and word characters
   * 
   * Examples:
   * - "spec" → matches
   * - "spec-name" → matches  
   * - "spec-test-123" → matches
   * - "myspec" → doesn't match (must start with "spec")
   * 
   * Flags:
   * - i: case-insensitive matching
   */
  specName: /^spec$|^spec-*\w+$/i,

  /**
   * Matches terminology reference patterns for markdown-it extension filtering
   * Used to determine which markdown-it extension should handle term references
   * 
   * Pattern breakdown:
   * - ^def$ → Exact match for "def" (definition)
   * - ^ref$ → Exact match for "ref" (reference)
   * - ^xref → Starts with "xref" (external reference)
   * - ^tref → Starts with "tref" (typed reference)
   * 
   * Examples:
   * - "def" → matches
   * - "ref" → matches
   * - "xref" → matches
   * - "tref" → matches
   * - "xref:spec,term" → matches (starts with xref)
   * 
   * Flags:
   * - i: case-insensitive matching
   */
  terminology: /^def$|^ref$|^xref|^tref$/i
};

/**
 * Regular expressions for external references (xref/tref patterns)
 * Used for cross-referencing terms between specifications
 */
const externalReferences = {
  /**
   * Matches all external reference patterns: [[xref:...]] or [[tref:...]]
   * 
   * Used to find and extract external references from markdown content
   * 
   * Examples:
   * - [[xref:spec1,term1]]
   * - [[tref:spec2,term2,alias2]]
   * - [[xref: spec3, term3 ]]
   * 
   * Flags:
   * - g: global matching to find all occurrences
   */
  allXTrefs: /\[\[(?:xref|tref):.*?\]\]/g,

  /**
   * Captures the reference type (xref or tref) from external reference syntax
   * 
   * Groups:
   * - Group 1: reference type ('xref' or 'tref')
   * 
   * Examples:
   * - [[xref:spec,term]] → 'xref'
   * - [[tref:spec,term,alias]] → 'tref'
   */
  referenceType: /\[\[(xref|tref):/,

  /**
   * Pattern for removing opening [[xref: or [[tref: from external references
   * Used in preprocessing external reference strings
   * 
   * Examples:
   * - "[[xref:spec,term]]" → "spec,term]]" (after removal)
   * - "[[tref:spec,term,alias]]" → "spec,term,alias]]" (after removal)
   */
  openingTag: /\[\[(?:xref|tref):/,

  /**
   * Pattern for removing closing ]] from external references
   * Used in preprocessing external reference strings
   * 
   * Examples:
   * - "spec,term]]" → "spec,term" (after removal)
   * - "spec,term,alias]]" → "spec,term,alias" (after removal)
   */
  closingTag: /\]\]/,

  /**
   * Splits external reference arguments by comma
   * Used to separate spec, term, and optional alias
   * 
   * Examples:
   * - "spec,term,alias" → ['spec', 'term', 'alias']
   * - "spec1,term-with-dashes" → ['spec1', 'term-with-dashes']
   */
  argsSeparator: /,/,

  /**
   * Tref specification name extractor pattern
   * Extracts the spec name from a tref tag (first argument before comma)
   * 
   * Pattern breakdown:
   * - \[\[tref: → Literal [[tref:
   * - ([^,]+) → Capture group 1: spec name (anything except comma)
   * 
   * Examples:
   * - "[[tref:spec1,term]]" → captures "spec1"
   * - "[[tref: myspec , myterm]]" → captures " myspec "
   * 
   * Used in health-check/term-references-checker.js
   */
  trefSpecExtractor: /\[\[tref:([^,]+)/
};

/**
 * Regular expressions for escaping special regex characters
 * Used to prevent regex injection and ensure literal character matching
 */
const escaping = {
  /**
   * Matches special regex characters that need escaping
   * 
   * Characters matched: . * + ? ^ $ { } ( ) | [ ] \ -
   * These are escaped with backslashes to treat them as literal characters
   * 
   * Used in functions that build dynamic regex patterns from user input
   * 
   * Examples:
   * - "test.term" → "test\\.term"
   * - "term-with-dashes" → "term\\-with\\-dashes"
   * - "spec(v1)" → "spec\\(v1\\)"
   * 
   * Flags:
   * - g: global to escape all occurrences
   */
  specialChars: /[.*+?^${}()|[\]\\-]/g,
  
  /**
   * Placeholder pattern for escaped template tags
  * Used in escape-processor.js to replace escaped placeholders with literal [[
   * 
   * Flags:
   * - g: global to replace all placeholders
   */
  placeholderRegex: /__SPEC_UP_ESCAPED_TAG__/g
};

/**
 * Regular expressions for path normalization and manipulation
 * Used in file system operations and URL handling
 */
const paths = {
  /**
   * Matches trailing forward slashes at the end of paths
   * Used to normalize paths by removing trailing slashes before adding them back
   * 
   * Examples:
   * - "path/to/dir/" → "path/to/dir" (after removal)
   * - "path/to/dir///" → "path/to/dir" (after removal)
   * 
   * Flags:
   * - g: global to remove all trailing slashes
   */
  trailingSlash: /\/$/g
};

/**
 * Regular expressions for version pattern matching
 * Used in freeze functionality and version management
 */
const versions = {
  /**
   * Matches version directory patterns like "v1", "v2", "v123"
   * 
   * Groups:
   * - Group 1: version number (digits only)
   * 
   * Used to identify and parse version directories in freeze functionality
   * 
   * Examples:
   * - "v1" → version: '1'
   * - "v42" → version: '42'
   * - "v999" → version: '999'
   * 
   * Non-matches:
   * - "version1" (doesn't start with 'v')
   * - "v1.2" (contains non-digit characters)
   * - "V1" (uppercase V)
   */
  pattern: /^v(\d+)$/
};



/**
 * Regular expressions for gitignore pattern matching
 * Used in health check functionality for validating gitignore patterns
 */
const gitignore = {
  /**
   * Template for converting gitignore glob patterns to regex
   * 
   * Used to check if file paths match gitignore patterns with wildcards
   * 
   * Construction:
   * - Replace asterisk with dot-asterisk
   * - Replace forward slash with escaped forward slash
   * - Wrap with caret and dollar for exact matching
   * 
   * This pattern is constructed dynamically at runtime
   */
  globToRegex: 'DYNAMIC_PATTERN' // Constructed at runtime
};

/**
 * Regular expressions for whitespace handling
 * Used throughout the codebase for text processing
 */
const whitespace = {
  /**
   * Matches one or more consecutive whitespace characters
   * Used for normalizing spaces in term processing
   * 
   * Examples:
   * - "term with spaces" → "term-with-spaces" (when replaced with '-')
   * - "multiple   spaces" → "multiple-spaces" (when replaced with '-')
   * 
   * Flags:
   * - g: global to replace all whitespace sequences
   */
  oneOrMore: /\s+/g
};

/**
 * Regular expressions for URL and link processing
 * Used in server-side URL manipulation and external references
 */
const urls = {
  /**
   * Matches URL patterns for extracting base URL from versioned URLs
   * 
   * Groups:
   * - Group 1: base URL (protocol + domain + path up to /versions/)
   * 
   * Used for processing versioned URLs in server-side context
   * 
   * Examples:
   * - "https://example.com/spec/versions/v1/" → base: "https://example.com/spec"
   * - "http://localhost:3000/docs/versions/latest/" → base: "http://localhost:3000/docs"
   */
  versionsBase: /^(https?:\/\/[^\/]+(?:\/[^\/]+)*)\/versions\/(?:[^\/]+\/)?/
};

/**
 * Regular expressions for parsing HTML comments and metadata
 * Used in source tracking and content processing
 */
const htmlComments = {
  /**
   * Matches HTML file tracking comments inserted by the renderer
   * 
   * Groups:
   * - Group 1: filename (path to the source file)
   * 
   * Used to extract the source file name from HTML comments for tracking purposes
   * 
   * Examples:
   * - "<!-- file: src/example.md -->" → filename: "src/example.md"
   * - "<!-- file: docs/spec.md -->" → filename: "docs/spec.md"
   * 
   * Pattern breakdown:
   * - <!-- file: → Literal HTML comment start with "file: "
   * - (.+?) → Capture group 1: filename (non-greedy)
   * - --> → Literal HTML comment end
   */
  fileTracker: /<!-- file: (.+?) -->/
};

/**
 * Regular expressions for content cleaning and sanitization
 * Used in tooltip generation and safe HTML output
 */
const contentCleaning = {
  /**
   * Matches double quotes for escaping in HTML attributes
   * Used to prevent HTML attribute injection and ensure safe tooltip content
   * 
   * Examples:
   * - 'text with "quotes"' → 'text with &quot;quotes&quot;'
   * 
   * Flags:
   * - g: global to replace all quotes
   */
  quotes: /"/g,

  /**
   * Matches newline characters for content normalization
   * Used to convert multiline content to single line for tooltips
   * 
   * Examples:
   * - "line1\nline2\nline3" → "line1 line2 line3" (when replaced with ' ')
   * 
   * Flags:
   * - g: global to replace all newlines
   */
  newlines: /\n/g
};

/**
 * Export object containing all regex categories
 * 
 * Usage:
 * const { templateTags, externalReferences } = require('./regex-patterns');
 * const match = text.match(templateTags.replacer);
 */
module.exports = {
  templateTags,
  externalReferences,
  escaping,
  paths,
  versions,
  gitignore,
  whitespace,
  urls,
  htmlComments,
  contentCleaning
};

/**
 * Utility functions for common regex operations
 * These functions encapsulate complex regex construction patterns
 */
const utils = {
  /**
   * Escapes special regex characters in a string to treat them literally
   * 
   * @param {string} str - String to escape
   * @returns {string} String with special regex characters escaped
   * 
   * Example:
   * escapeRegexChars("test.file") → "test\\.file"
   */
  escapeRegexChars: function(str) {
    return str.replace(escaping.specialChars, '\\$&');
  },

  /**
   * Creates a dynamic regex for matching external references with specific spec and term
   * 
   * @param {string} spec - External specification identifier
   * @param {string} term - Term to match
   * @returns {RegExp} Compiled regex for matching the specific external reference
   * 
   * Example:
   * createXTrefRegex("spec1", "term1") → /\[\[(?:x|t)ref:\s*spec1,\s*term1(?:,\s*[^\]]+)?\]\]/g
   */
  createXTrefRegex: function(spec, term) {
    const escapedSpec = this.escapeRegexChars(spec);
    const escapedTerm = this.escapeRegexChars(term);
    return new RegExp(`\\[\\[(?:x|t)ref:\\s*${escapedSpec},\\s*${escapedTerm}(?:,\\s*[^\\]]+)?\\]\\]`, 'g');
  },

  /**
   * Creates a regex for matching gitignore glob patterns
   * 
   * @param {string} globPattern - Gitignore pattern with wildcards
   * @returns {RegExp} Compiled regex for matching file paths
   * 
   * Example:
   * createGitignoreRegex("dist/*") → /^dist\/.*$/
   */
  createGitignoreRegex: function(globPattern) {
    const pattern = '^' + globPattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$';
    return new RegExp(pattern);
  }
};

// Also export utility functions
module.exports.utils = utils;