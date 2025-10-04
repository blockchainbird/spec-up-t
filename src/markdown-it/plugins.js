/**
 * Configures and applies external markdown-it plugins to a given markdown-it instance.
 * This module centralizes plugin loading to reduce complexity in the main index.js file.
 * It handles only the external npm plugins (e.g., markdown-it-attrs), not custom extensions.
 * 
 * @param {Object} md - The markdown-it instance to configure
 * @param {Object} config - Configuration object (e.g., for TOC anchor symbol)
 * @param {Object} containers - The markdown-it-container instance (passed to avoid re-requiring)
 * @param {Object} noticeTypes - Object defining valid notice types (e.g., { note: 1, issue: 1, ... })
 * @param {Object} noticeTitles - Object to track notice titles (passed to maintain state)
 * @returns {Object} The configured markdown-it instance
 */
function configurePlugins(md, config, containers, noticeTypes, noticeTitles, setToc) {
  // Apply attribute support for elements (e.g., {.class} syntax)
  // This enables adding CSS classes or IDs to markdown elements without HTML.
  md.use(require('markdown-it-attrs'));

  // Enable chart rendering from code blocks (e.g., ```chart ... ```)
  // Useful for embedding diagrams directly in markdown.
  md.use(require('markdown-it-chart').default);

  // Support definition lists (e.g., term\n: definition)
  // Enhances standard markdown with formal definition formatting.
  md.use(require('markdown-it-deflist'));

  // Add reference-style links and footnotes
  // Allows cleaner link management in long documents.
  md.use(require('markdown-it-references'));

  // Enable Font Awesome icons (e.g., :fa-icon:)
  // Integrates icon rendering for visual enhancements.
  md.use(require('markdown-it-icons').default, 'font-awesome');

  // Support <ins> tags for inserted text (e.g., ++text++)
  // Useful for highlighting additions in specs.
  md.use(require('markdown-it-ins'));

  // Support <mark> tags for highlighted text (e.g., ==text==)
  // Helps emphasize important terms or sections.
  md.use(require('markdown-it-mark'));

  // Enable textual UML diagrams (e.g., @startuml ... @enduml)
  // Allows embedding diagrams without external tools.
  md.use(require('markdown-it-textual-uml'));

  // Support subscript text (e.g., H~2~O)
  // Essential for scientific or technical writing.
  md.use(require('markdown-it-sub'));

  // Support superscript text (e.g., E=mc^2^)
  // Complements subscript for mathematical expressions.
  md.use(require('markdown-it-sup'));

  // Enable task lists (e.g., - [x] Task)
  // Great for checklists in documentation.
  md.use(require('markdown-it-task-lists'));

  // Support multi-line tables with rowspan/colspan
  // Extends basic tables for complex layouts.
  md.use(require('markdown-it-multimd-table'), {
    multiline: true,
    rowspan: true,
    headerless: true
  });

  // Configure notice containers (e.g., ::: note ... :::)
  // Uses the passed containers plugin for custom blocks like warnings or examples.
  md.use(containers, 'notice', {
    validate: function (params) {
      // Check if the notice type is valid (e.g., 'note', 'issue')
      let matches = params.match(/(\w+)\s?(.*)?/);
      return matches && noticeTypes[matches[1]];
    },
    render: function (tokens, idx) {
      // Render opening or closing tags for notices
      let matches = tokens[idx].info.match(/(\w+)\s?(.*)?/);
      if (matches && tokens[idx].nesting === 1) {
        let id;
        let type = matches[1];
        if (matches[2]) {
          // Custom ID from title
          id = matches[2].trim().replace(/\s+/g, '-').toLowerCase();
          if (noticeTitles[id]) id += '-' + noticeTitles[id]++;
          else noticeTitles[id] = 1;
        } else {
          // Auto-generated ID
          id = type + '-' + noticeTypes[type]++;
        }
        return `<div id="${id}" class="notice ${type}"><a class="notice-link" href="#${id}">${type.toUpperCase()}</a>`;
      } else {
        return '</div>\n';
      }
    }
  });

  // Add syntax highlighting with Prism.js
  // Enhances code blocks with colorized syntax.
  md.use(require('markdown-it-prism'));

  // Generate table of contents with anchors
  // Automatically creates TOC from headings, with customizable symbols.
  md.use(require('markdown-it-toc-and-anchor').default, {
    tocClassName: 'toc',
    tocFirstLevel: 2,
    tocLastLevel: 4,
    tocCallback: (_md, _tokens, html) => setToc(html),
    anchorLinkSymbol: config.specs[0].anchor_symbol || '§',
    anchorClassName: 'toc-anchor d-print-none'
  });

  // Enable KaTeX for math rendering (e.g., $$...$$)
  // Supports inline and block math expressions.
  md.use(require('@traptitech/markdown-it-katex'));

  return md;
}

module.exports = { configurePlugins };