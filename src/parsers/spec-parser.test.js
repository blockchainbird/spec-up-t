/**
 * Spec Parser Tests - Functional Style
 *
 * These tests verify that the specification parsing functions work correctly
 * and maintain backward compatibility while providing better testability.
 */

const {
  createSpecParser
} = require('../pipeline/parsing/create-markdown-parser.js');

// Import functions directly from their modules since they're not exported through index
const {
  parseSpecReference,
  renderIndividualSpec,
  hasSpec
} = require('./spec-parser');

// Tests for verifying the specification parsing functions work correctly
describe('Specification Parsing Functions', () => {
  let mockGlobal, mockSpecCorpus;

  beforeEach(() => {
    mockGlobal = {
      definitions: [],
      references: [],
      specGroups: {},
      noticeTitles: {},
      currentFile: 'test.md'
    };

    mockSpecCorpus = {
      'RFC-2119': {
        title: 'Key words for use in RFCs',
        href: 'https://tools.ietf.org/html/rfc2119'
      }
    };

    // Set up global state
    global.definitions = mockGlobal.definitions;
    global.references = mockGlobal.references;
    global.specGroups = mockGlobal.specGroups;
    global.noticeTitles = mockGlobal.noticeTitles;
  });

  // Test: Can the system parse specification references properly?
  test('should parse spec reference correctly', () => {
    const mockToken = { info: {} };

    parseSpecReference(mockSpecCorpus, mockGlobal, mockToken, 'spec', 'RFC-2119');

    expect(mockGlobal.specGroups.spec).toBeDefined();
    expect(mockGlobal.specGroups.spec['RFC-2119']).toBeDefined();
    expect(mockToken.info.spec).toBeDefined();
  });

  // Test: Can the system render individual spec references as HTML?
  test('should render individual spec correctly', () => {
    const mockToken = {
      info: {
        spec: {
          _name: 'RFC-2119',
          title: 'Key words for use in RFCs'
        }
      }
    };

    const result = renderIndividualSpec(mockToken);

    expect(result).toContain('class="spec-reference"');
    expect(result).toContain('href="#ref:RFC-2119"');
    expect(result).toContain('RFC-2119');
  });

  // Test: Can the system determine if a specification exists?
  test('should check if spec exists', () => {
    expect(hasSpec(mockSpecCorpus, 'RFC-2119')).toBe(true);
    expect(hasSpec(mockSpecCorpus, 'nonexistent-spec')).toBe(false);
  });

  // Test: Does the spec parser factory create functional parsers?
  test('createSpecParser should return a working parser object', () => {
    const specParser = createSpecParser(mockSpecCorpus, mockGlobal);

    expect(typeof specParser.parseSpecReference).toBe('function');
    expect(typeof specParser.renderSpecReference).toBe('function');
    expect(typeof specParser.hasSpec).toBe('function');

    expect(specParser.hasSpec('RFC-2119')).toBe(true);
  });

  // Test: Can the functions be combined and used together effectively?
  test('functions should compose well', () => {
    // Test that functions can be used in different combinations
    const specParser = createSpecParser(mockSpecCorpus, mockGlobal);

    // Should be independent functions
    expect(typeof specParser).toBe('object');
    expect(typeof specParser.parseSpecReference).toBe('function');
  });

  // Test: Can individual functions be imported and used separately?
  test('individual functions should be importable', () => {
    // Test that individual functions can be imported and used
    expect(typeof hasSpec).toBe('function');
    expect(typeof parseSpecReference).toBe('function');
    expect(typeof renderIndividualSpec).toBe('function');
  });
});