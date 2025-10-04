/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview Unit tests for highlight-heading-plus-sibling-nodes.js
 * Covers all exported functions to satisfy SonarQube coverage requirements.
 */
const {
  highlightHeadingSection,
  getHeadingLevel,
  collectHeadingSiblings,
  wrapNodesWithHighlight,
  removeExistingHighlights,
  initializeAnchorHighlighting
} = require('./highlight-heading-plus-sibling-nodes');

// Tests for highlighting heading sections and their related content
describe('highlight-heading-plus-sibling-nodes', () => {
  let container;

  beforeEach(() => {
    // Set up a DOM structure for testing
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.innerHTML = `
      <h2 id="h2-1">Heading 2</h2>
      <p id="p1">Paragraph 1</p>
      <ul id="ul1"><li>Item</li></ul>
      <h3 id="h3-1">Heading 3</h3>
      <p id="p2">Paragraph 2</p>
      <h2 id="h2-2">Heading 2b</h2>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Tests for determining heading levels (h2-h6)
  describe('getHeadingLevel', () => {
    // Test: Can the system correctly identify heading levels?
    it('returns correct level for h2-h6', () => {
      expect(getHeadingLevel(document.getElementById('h2-1'))).toBe(2);
      expect(getHeadingLevel(document.getElementById('h3-1'))).toBe(3);
    });
    // Test: Does the system properly reject invalid headings?
    it('returns null for h1 or non-heading', () => {
      const h1 = document.createElement('h1');
      expect(getHeadingLevel(h1)).toBeNull();
      expect(getHeadingLevel(document.getElementById('p1'))).toBeNull();
    });
  });

  // Tests for collecting heading sections (heading + related content)
  describe('collectHeadingSiblings', () => {
    // Test: Can the system collect all content belonging to a heading section?
    it('collects heading and following siblings until next heading of same or higher level', () => {
      const h2 = document.getElementById('h2-1');
      const siblings = collectHeadingSiblings(h2, 2);
      expect(siblings.map(n => n.id)).toEqual(['h2-1', 'p1', 'ul1', 'h3-1', 'p2']);
    });
    // Test: Does the system stop collecting at the right boundary?
    it('stops at next heading of same or higher level', () => {
      const h3 = document.getElementById('h3-1');
      const siblings = collectHeadingSiblings(h3, 3);
      expect(siblings.map(n => n.id)).toEqual(['h3-1', 'p2']);
    });
  });

  // Tests for wrapping content with highlight styling
  describe('wrapNodesWithHighlight', () => {
    // Test: Can the system wrap selected content with highlight styling?
    it('wraps nodes in a div.highlight2', () => {
      const nodes = [document.getElementById('h2-1'), document.getElementById('p1')];
      const wrapper = wrapNodesWithHighlight(nodes);
      expect(wrapper).not.toBeNull();
      expect(wrapper.className).toBe('highlight2');
      expect(wrapper.contains(nodes[0])).toBe(true);
      expect(wrapper.contains(nodes[1])).toBe(true);
    });
    // Test: Does the system handle empty input gracefully?
    it('returns null if nodes is empty', () => {
      expect(wrapNodesWithHighlight([])).toBeNull();
    });
  });

  // Tests for cleaning up existing highlights
  describe('removeExistingHighlights', () => {
    // Test: Can the system remove highlights and restore original content structure?
    it('removes all .highlight2 wrappers and restores children', () => {
      const nodes = [document.getElementById('h2-1'), document.getElementById('p1')];
      wrapNodesWithHighlight(nodes);
      expect(document.querySelectorAll('.highlight2').length).toBe(1);
      const removed = removeExistingHighlights();
      expect(removed).toBe(1);
      expect(document.querySelectorAll('.highlight2').length).toBe(0);
      // Children are restored to parent
      expect(container.contains(nodes[0])).toBe(true);
      expect(container.contains(nodes[1])).toBe(true);
    });
  });

  // Tests for the main highlighting functionality
  describe('highlightHeadingSection', () => {
    // Test: Can the system highlight a section when given a valid anchor?
    it('highlights section for valid anchor', () => {
      expect(highlightHeadingSection('#h2-1')).toBe(true);
      const highlight = document.querySelector('.highlight2');
      expect(highlight).not.toBeNull();
      expect(highlight.contains(document.getElementById('h2-1'))).toBe(true);
    });
    // Test: Does the system properly reject invalid anchors?
    it('returns false for invalid anchor', () => {
      expect(highlightHeadingSection('#does-not-exist')).toBe(false);
      expect(highlightHeadingSection('not-a-hash')).toBe(false);
      expect(highlightHeadingSection('#')).toBe(false);
    });
    // Test: Does the system only work with heading elements?
    it('returns false for non-heading element', () => {
      expect(highlightHeadingSection('#p1')).toBe(false);
    });
  });

  // Tests for setting up automatic highlighting based on URL anchors
  describe('initializeAnchorHighlighting', () => {
    // Test: Does the system automatically highlight sections based on URL hash changes?
    it('sets up event listeners and highlights on hash', () => {
      window.location.hash = '#h2-1';
      // Remove highlights if any
      removeExistingHighlights();
      initializeAnchorHighlighting();
      // Simulate hashchange
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(document.querySelector('.highlight2')).not.toBeNull();
    });
  });
});
