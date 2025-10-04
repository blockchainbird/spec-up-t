/**
 * Markdown Parser Integration Tests - Functional Style
 *
 * These tests verify that the markdown parser integration works correctly
 * and maintains backward compatibility while providing better testability.
 */

const {
  createMarkdownParser
} = require('./create-markdown-parser.js');

// Tests for integrating the functional parser system with markdown processing
describe('Markdown Parser Integration', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      specs: [{
        external_specs: [{
          external_spec: 'test-spec',
          gh_page: 'https://example.com/spec'
        }]
      }]
    };
  });

  // Test: Can the system create a markdown parser using the functional approach?
  test('should create parser with functional system', () => {
    const mockSetToc = jest.fn();
    const parser = createMarkdownParser(mockConfig, mockSetToc);

    expect(parser).toBeDefined();
    expect(parser.render).toBeDefined();
  });

  // Test: Does the refactored system maintain compatibility with existing markdown processing?
  test('should maintain backward compatibility', () => {
    const mockSetToc = jest.fn();
    const parser = createMarkdownParser(mockConfig, mockSetToc);

    // Test basic markdown rendering still works
    const basicMarkdown = '# Test Heading\n\nSome content.';
    const result = parser.render(basicMarkdown);

    expect(result).toContain('<h1');
    expect(result).toContain('Test Heading');
    expect(result).toContain('<p>Some content.</p>');
  });
});