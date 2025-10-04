/**
 * @file regex-patterns.test.js
 * @description Comprehensive test suite for centralized regex patterns
 * 
 * This test verifies that all regex patterns in the centralized module
 * work correctly and maintain backwards compatibility.
 * 
 * @requires Jest testing framework
 * @version 1.0.0
 */

const {
  templateTags,
  externalReferences,
  escaping,
  paths,
  versions,
  search,
  gitignore,
  whitespace,
  urls,
  utils
} = require('./regex-patterns');

// Tests for verifying all centralized regex patterns work correctly
describe('Centralized Regex Patterns Test Suite', () => {
  
  // Tests for regex patterns that handle template tag markup
  describe('Template Tags Patterns', () => {
    
    // Test: Can the system identify all types of template tag markup?
    test('replacer pattern identifies template tags', () => {
      const testCases = [
        '[[def: term]]',
        '[[insert:path/file]]',
        '[[xref: spec, term, alias]]'
      ];

      testCases.forEach(testCase => {
        // Reset regex state for global regex
        templateTags.replacer.lastIndex = 0;
        expect(templateTags.replacer.test(testCase)).toBe(true);
      });
    });

    // Test: Can the system split comma-separated arguments correctly?
    test('argsSeparator splits comma-separated values', () => {
      const input = 'term, alias, extra';
      const result = input.split(templateTags.argsSeparator);
      expect(result).toEqual(['term', 'alias', 'extra']);
    });

    // Test: Can the system replace template variables with actual values?
    test('variableInterpolation replaces template variables', () => {
      const template = 'Hello ${name}, version ${version}';
      const result = template.replace(templateTags.variableInterpolation, (match, p1) => {
        const vars = { name: 'World', version: '1.0' };
        return vars[p1.trim()] || match;
      });
      expect(result).toBe('Hello World, version 1.0');
    });
  });

  // Tests for regex patterns that handle external specification references
  describe('External References Patterns', () => {
    
    // Test: Can the system find all external reference markup in content?
    test('allXTrefs finds external references', () => {
      const content = 'Text with [[xref:spec,term]] and [[tref:spec2,term2]].';
      const matches = content.match(externalReferences.allXTrefs);
      expect(matches).toHaveLength(2);
      expect(matches[0]).toBe('[[xref:spec,term]]');
      expect(matches[1]).toBe('[[tref:spec2,term2]]');
    });

    // Test: Can the system distinguish between xref and tref reference types?
    test('referenceType extracts xref/tref type', () => {
      const xrefMatch = '[[xref:spec,term]]'.match(externalReferences.referenceType);
      const trefMatch = '[[tref:spec,term]]'.match(externalReferences.referenceType);
      
      expect(xrefMatch[1]).toBe('xref');
      expect(trefMatch[1]).toBe('tref');
    });

    // Test: Can the system extract specification names from tref markup?
    test('trefSpecExtractor gets spec name from tref', () => {
      const match = '[[tref:myspec,term]]'.match(externalReferences.trefSpecExtractor);
      expect(match[1]).toBe('myspec');
    });
  });

  // Tests for regex patterns that handle character escaping
  describe('Escaping Patterns', () => {
    
    // Test: Can the system escape special regex characters properly?
    test('specialChars can be used for escaping', () => {
      const input = 'test.file+regex*chars';
      const escaped = input.replace(escaping.specialChars, '\\$&');
      expect(escaped).toContain('\\.');
      expect(escaped).toContain('\\+');
      expect(escaped).toContain('\\*');
    });

    // Test: Can the system match escaped placeholder patterns?
    test('placeholderRegex matches escaped placeholders', () => {
      const content = 'Text with __SPEC_UP_ESCAPED_TAG__ here';
      expect(escaping.placeholderRegex.test(content)).toBe(true);
    });
  });

  // Tests for regex patterns that handle file path operations
  describe('Path Patterns', () => {
    
    // Test: Can the system remove trailing slashes from paths?
    test('trailingSlash removes trailing slashes', () => {
      const testCases = [
        { input: 'path/to/dir/', expected: 'path/to/dir' },
        { input: 'path/to/dir', expected: 'path/to/dir' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input.replace(paths.trailingSlash, '');
        expect(result).toBe(expected);
      });
    });
  });

  // Tests for regex patterns that handle version directory naming
  describe('Version Patterns', () => {
    
    // Test: Can the system identify valid version directory names?
    test('pattern matches version directories', () => {
      expect(versions.pattern.test('v1')).toBe(true);
      expect(versions.pattern.test('v123')).toBe(true);
      expect(versions.pattern.test('version1')).toBe(false);
      expect(versions.pattern.test('1')).toBe(false);
    });
  });

  // Tests for regex patterns that handle whitespace normalization
  describe('Whitespace Patterns', () => {
    
    // Test: Can the system collapse multiple whitespace characters?
    test('oneOrMore collapses multiple spaces', () => {
      const input = 'text   with    spaces';
      const result = input.replace(whitespace.oneOrMore, ' ');
      expect(result).toBe('text with spaces');
    });
  });

  // Tests for regex patterns that handle URL parsing
  describe('URL Patterns', () => {
    
    // Test: Can the system extract base URLs from version URLs?
    test('versionsBase extracts base URL', () => {
      const testUrl = 'https://example.com/spec/versions/v1/';
      const match = testUrl.match(urls.versionsBase);
      expect(match[1]).toBe('https://example.com/spec');
    });
  });

  // Tests for utility functions that help with regex operations
  describe('Utility Functions', () => {
    
    // Test: Can the utility function escape regex special characters?
    test('escapeRegexChars escapes special characters', () => {
      const result = utils.escapeRegexChars('test.file');
      expect(result).toBe('test\\.file');
    });

    // Test: Can the utility create regex patterns for external references?
    test('createXTrefRegex creates working regex', () => {
      const regex = utils.createXTrefRegex('spec1', 'term1');
      regex.lastIndex = 0; // Reset state
      expect(regex.test('[[xref: spec1, term1]]')).toBe(true);
      regex.lastIndex = 0; // Reset state
      expect(regex.test('[[tref: spec1, term1, alias]]')).toBe(true);
    });

    // Test: Can the utility convert gitignore patterns to working regex?
    test('createGitignoreRegex converts globs to regex', () => {
      const regex = utils.createGitignoreRegex('*.js');
      expect(regex.test('file.js')).toBe(true);
      expect(regex.test('file.txt')).toBe(false);
    });
  });

  // Tests verifying patterns work together in realistic scenarios
  describe('Pattern Integration Tests', () => {
    
    // Test: Do all patterns work correctly with realistic specification content?
    test('processes realistic spec content', () => {
      const specContent = `
        # Test Specification
        
        This defines [[def: test-term]] and references [[xref: external-spec, external-term]].
        
        [[insert: sections/intro.md]]
        
        Version directory: v1
      `;

      // Test that patterns can find their respective content
      expect(templateTags.replacer.test(specContent)).toBe(true);
      expect(externalReferences.allXTrefs.test(specContent)).toBe(true);
      expect(versions.pattern.test('v1')).toBe(true);
    });

    // Test: Do the patterns handle unusual or malformed input without errors?
    test('handles edge cases gracefully', () => {
      const edgeCases = [
        '',
        '[[]]',
        '[[def:]]',
        'no patterns here',
        '[[def: term with unicode: tëst]]'
      ];

      edgeCases.forEach(testCase => {
        // Should not throw errors
        expect(() => templateTags.replacer.test(testCase)).not.toThrow();
        expect(() => externalReferences.allXTrefs.test(testCase)).not.toThrow();
        expect(() => utils.escapeRegexChars(testCase)).not.toThrow();
      });
    });
  });

  // Tests ensuring patterns perform well with large content
  describe('Performance Validation', () => {
    
    // Test: Can the patterns process large amounts of content quickly?
    test('handles large content efficiently', () => {
      const largeContent = Array(1000).fill('[[def: term]] some text [[xref:spec,term]]').join(' ');
      
      const startTime = Date.now();
      const matches = largeContent.match(templateTags.replacer);
      const endTime = Date.now();
      
      expect(matches).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  // Tests ensuring patterns maintain compatibility with existing content
  describe('Backwards Compatibility Validation', () => {
    
    // Test: Do the patterns still work with all historical template tag formats?
    test('template tag replacer works with all historical patterns', () => {
      const historicalExamples = [
        '[[def: simple-term]]',
        '[[def: term-with-dashes, alias-with-dashes]]',
        '[[xref: external-spec, external-term]]',
        '[[tref: another-spec, another-term, custom-alias]]',
        '[[insert: path/to/file.md]]'
      ];

      historicalExamples.forEach(example => {
        // Reset regex state for global regex
        templateTags.replacer.lastIndex = 0;
        expect(templateTags.replacer.test(example)).toBe(true);
      });
    });

    // Test: Do external reference patterns work with existing specification formats?
    test('external reference patterns maintain format compatibility', () => {
      const externalRefContent = `
        This specification references [[xref: RFC7515, JSON Web Signature]].
        It also uses [[tref: KERI, Key Event Receipt Infrastructure, KERI protocol]].
        Multiple refs: [[xref: spec1, term1]] and [[tref: spec2, term2, alias2]].
      `;

      const matches = externalRefContent.match(externalReferences.allXTrefs);
      expect(matches).toHaveLength(4);
      
      // Verify each match follows expected format
      matches.forEach(match => {
        expect(match).toMatch(/^\[\[(?:x|t)ref:\s*[^,\]]+(?:,\s*[^,\]]+)*\]\]$/);
      });
    });
  });
});