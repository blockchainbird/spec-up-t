# Markdown-it Extensions

This directory contains the refactored markdown-it extensions used by the spec-up-t system. The extensions have been broken down into focused, well-documented modules to improve maintainability and understanding.

## Module Overview

### Core Philosophy

The markdown-it library uses a token-based rendering system where:

- **Tokens** represent different parts of the markdown (paragraphs, headers, tables, etc.)
- **Renderer rules** are functions that convert tokens to HTML
- **Inline rules** process inline elements during parsing
- **Plugins** extend the parser with custom functionality

Our extensions override default renderer rules and add custom inline parsing rules to implement spec-up-specific functionality.

## Modules

### 1. `table-enhancement.js`

**Purpose**: Enhances table rendering with Bootstrap styling and responsive wrappers.

**Features**:

- Adds Bootstrap CSS classes (`table`, `table-striped`, `table-bordered`, `table-hover`)
- Wraps tables in responsive containers (`table-responsive-md`)
- Preserves existing classes while adding new ones

**How it works**: Overrides `table_open` and `table_close` renderer rules.

### 2. `template-tag-syntax.js`

**Purpose**: Processes custom template-tag syntax like `[[def:term]]`, `[[tref:spec,term]]`, etc.

**Features**:

- Parses `[[type:arg1,arg2]]` syntax during markdown processing
- Creates template tokens for later rendering
- Supports extensible template-tag handlers
- Integrates with the escape mechanism

**How it works**:

- Adds an inline ruler (`templates_ruler`) to detect and parse template-tag syntax
- Creates template tokens with parsed information
- Provides a renderer rule to convert template tokens to HTML

### 3. `link-enhancement.js`

**Purpose**: Adds path-based attributes to links for CSS styling and JavaScript targeting.

**Features**:

- Extracts domain and path segments from URLs
- Adds `path-0`, `path-1`, etc. attributes to anchor tags
- Special handling for auto-detected links (linkify)

**How it works**: Overrides `link_open` and `link_close` renderer rules.

### 4. `definition-lists.js`

**Purpose**: Advanced processing of definition lists for terminology and reference management.

**Features**:

- **Smart Classification**: Distinguishes between terminology lists and reference lists
- **Term Type Detection**: Identifies local terms (`[[def:term]]`) vs external terms (`[[tref:spec,term]]`)
- **Quality Control**: Removes empty `<dt>` elements that cause rendering issues
- **Section-Aware**: Only applies terminology styling after the terminology section marker

**How it works**:

- Overrides `dl_open`, `dt_open`, and `dt_close` renderer rules
- Uses helper functions to analyze token structure and content
- Applies CSS classes based on term types and context

### 5. `index.js`

**Purpose**: Main orchestrator that applies all enhancements in the correct order.

**Features**:

- Single entry point for all markdown-it extensions
- Maintains dependency order between modules
- Provides both unified and individual module access

## Usage

### Basic Usage

```javascript
const MarkdownIt = require('markdown-it');
const applyMarkdownItExtensions = require('./markdown-it');

const md = new MarkdownIt();
const templates = [
  {
    filter: type => type === 'def',
    render: (token, type, term) => `<span id="term:${term}">${term}</span>`
  }
];

applyMarkdownItExtensions(md, templates);
const html = md.render('[[def:example-term]]');
```

### Individual Module Usage

```javascript
const applyTableEnhancements = require('./markdown-it/table-enhancement');
const applyTemplateTagSyntax = require('./markdown-it/template-tag-syntax');

// Apply only table enhancements
applyTableEnhancements(md);

// Apply only template-tag syntax with custom handlers
applyTemplateTagSyntax(md, templates);
```

## Template System

The template-tag system processes custom syntax like `[[type:args]]` in markdown. Template-tags are defined as objects with:

- `filter(type)`: Function that returns true if this handler processes the given type
- `parse(token, type, ...args)`: Optional preprocessing function called during parsing
- `render(token, type, ...args)`: Function that returns HTML string for rendering

### Example Template-Tag Handler

```javascript
{
  filter: type => type.match(/^def$/),
  parse: (token, type, term, alias) => {
    // Preprocessing during markdown parsing
    definitions.push([term, alias]);
    return `<span id="term:${term.replace(/\s+/g, '-').toLowerCase()}">${term}</span>`;
  },
  render: (token, type, ...args) => {
    // Final rendering (if parse didn't handle it)
    return token.content;
  }
}
```

## Definition List Processing

The definition list module implements sophisticated logic for handling terminology:

### List Classification

- **Terminology Lists**: Get `terms-and-definitions-list` class
- **Reference Lists**: Keep existing classes (e.g., `reference-list`)
- **Section-Aware**: Only processes lists after `terminology-section-start` marker

### Term Classification

- **Local Terms** (`[[def:term]]`): Get `term-local` class
- **External Terms** (`[[tref:spec,term]]`): Get `term-external` class
- **Regular Terms**: No special class

### Quality Control

- **Empty Elements**: Removes `<dt>` elements with no content
- **Spec References**: Avoids styling bibliographic references as terminology

## Development Guidelines

### Adding New Modules

1. Create a focused module in this directory
2. Follow the existing naming pattern (`feature-name.js`)
3. Export a single function that takes a markdown-it instance
4. Add comprehensive documentation with examples
5. Update `index.js` to include the new module

### Code Quality

- Keep cognitive complexity below 15
- Add extensive comments for markdown-it concepts
- Use descriptive function and variable names
- Extract helper functions for complex logic
- Write tests for new functionality

### SonarQube Compliance

All modules must pass SonarQube analysis without issues. The refactoring specifically addresses:

- Reduced cognitive complexity through modularization
- Better code organization and separation of concerns
- Comprehensive documentation for maintainability

## Backward Compatibility

The main `markdown-it-extensions.js` file maintains complete backward compatibility by delegating to the new modular system. Existing code can continue to use the original interface without changes.

## Testing

Run the full test suite to ensure all functionality works correctly:

```bash
npm test
```

Individual modules can be tested by importing and using them directly in test files.

Please remember to run `gulp compile` after making changes to client-side assets, and test on a separate test machine before deployment.
