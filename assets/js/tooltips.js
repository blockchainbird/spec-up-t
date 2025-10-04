(function () {
  'use strict';

  /**
   * TOOLTIP SYSTEM OVERVIEW
   * =======================
   * This module creates interactive tooltips for term references in the specification.
   * It handles two types of content sources:
   * 
   * 1. LOCAL TERMS (tref and def): Content from the current document's DOM
   *    - These are definition lists <dt>/<dd> or table rows <tr>/<td>
   *    - Example: [[def: term, alias]] creates a local definition
   *    - Example: [[tref: ., term, alias]] references a local term
   * 
   * 2. EXTERNAL TERMS (xref): Content from external specifications
   *    - These come from the global allXTrefs data structure
   *    - Example: [[tref: externalreference, term]] references an external term
   *    - The allXTrefs data is populated by src/pipeline/references/external-references-service.js during build time
   *    - External content is fetched from other GitHub-hosted specifications
   */

  /* Tooltips WeakMap storage for performance optimization */
  // WeakMap prevents memory leaks by automatically garbage collecting 
  // when DOM elements are removed
  let tipMap = new WeakMap();

  /**
   * EVENT DELEGATION FOR TOOLTIP TRIGGERS
   * =====================================
   * Uses delegateEvent (from utils.js) to efficiently handle hover events.
   * Event delegation attaches a single listener to the document rather than
   * individual listeners on each term reference, improving performance.
   * 
   * TARGET SELECTORS:
   * - '.term-reference': Generated for [[tref: ...]] and [[def: ...]] constructions
   * - '.spec-reference': Generated for specification references
   * 
   * TRIGGER EVENT: 'pointerover' 
   * - Fires when mouse enters the element (more reliable than 'mouseenter')
   * - Works on both mouse and touch devices
   */
  delegateEvent('pointerover', '.term-reference, .spec-reference', (e, anchor) => {
    /**
     * EXTRACT TARGET INFORMATION
     * =========================
     * The anchor element contains attributes that tell us what term to show:
     * 
     * - data-local-href: For local references (format: #termname or #term:external:termname)
     * - href: Fallback attribute for standard links
     * 
     * Examples of generated markup:
     * - [[def: myterm]] creates: <a class="term-reference" data-local-href="#myterm">myterm</a>
     * - [[tref: ., myterm]] creates: <a class="term-reference" data-local-href="#myterm">myterm</a>
     * - [[tref: external, myterm]] creates: <a class="term-reference" data-local-href="#term:external:myterm">myterm</a>
     */
    const id = anchor.getAttribute('data-local-href') || anchor.getAttribute('href') || '';
    
    /**
     * ATTEMPT TO FIND LOCAL DOM ELEMENT
     * ================================
     * Try to find a DOM element with the ID (removing the # prefix).
     * This works for local definitions and some tref references.
     */
    let term = document.getElementById(id.replace('#', ''));

    /**
     * TOOLTIP CONFIGURATION
     * ====================
     * Base configuration for Tippy.js tooltips:
     * - allowHTML: Enables rich HTML content in tooltips
     * - inlinePositioning: Positions tooltip relative to cursor for better UX
     */
    let tip = {
      allowHTML: true,
      inlinePositioning: true
    };

    /**
     * PREVENT DUPLICATE TOOLTIPS
     * =========================
     * Check if we've already created a tooltip for this anchor element.
     * The WeakMap ensures efficient lookup and automatic cleanup.
     */
    if (tipMap.has(anchor)) return;

    if (term) {
      /**
       * LOCAL DOM-BASED TOOLTIP CONTENT
       * ===============================
       * When we find a matching DOM element, extract content from it.
       * The spec-up system creates definitions in two main formats:
       * 
       * 1. DEFINITION LIST FORMAT:
       *    <dt id="myterm">Term Name</dt>
       *    <dd>Term definition content goes here</dd>
       * 
       * 2. TABLE FORMAT:
       *    <table>
       *      <thead><tr><th>Term</th><th>Definition</th><th>Source</th></tr></thead>
       *      <tbody><tr><td id="myterm">Term Name</td><td>Definition</td><td>Source</td></tr></tbody>
       *    </table>
       */
      
      // Find the container element that holds the term definition
      // Look for either <dt> (definition term) or first <td> (table cell)
      let container = term.closest('dt, td:first-child');
      if (!container) return;

      switch (container.tagName) {
        case 'DT':
          /**
           * DEFINITION LIST PROCESSING
           * =========================
           * In a definition list, the <dt> contains the term name,
           * and the next sibling <dd> contains the definition text.
           * We extract the text content from the <dd> element.
           * If the first <dd> has class 'meta-info-content-wrapper', skip it and use the next <dd>.
           */
          let dd = container.nextElementSibling;
          if (dd && dd.tagName === 'DD' && dd.classList.contains('meta-info-content-wrapper')) {
            dd = dd.nextElementSibling;
          }
          if (dd && dd.tagName === 'DD') {
            tip.content = dd.textContent;
          }
          break;
          
        case 'TD':
          /**
           * TABLE FORMAT PROCESSING
           * ======================
           * For table-based definitions, we create a mini table showing
           * all the metadata associated with the term. This provides
           * richer context than just the definition text.
           * 
           * Process:
           * 1. Find the parent table and get all header cells
           * 2. Get all data cells from the current row
           * 3. Create HTML table mapping headers to values
           * 4. Skip the first column (which contains the term name itself)
           */
          let table = container.closest('table');
          let tds = Array.from(container.closest('tr').children);
          tds.shift(); // Remove first cell (the term name)
          
          if (table) {
            let headings = Array.from(table.querySelectorAll('thead th'));
            headings.shift(); // Remove first heading (matches the term name column)
            
            if (headings.length) {
              tip.content = `
              <header>${container.textContent}</header>
              <table>
                ${headings.map((th, i) => {
                return `<tr><td>${th.textContent}:</td><td>${tds[i] ? tds[i].textContent : ''}</td></tr>`
              }).join('')}
              </table>`;
            }
          }
          break;
      }
    } else {
      /**
       * EXTERNAL REFERENCE TOOLTIP CONTENT
       * ==================================
       * When no local DOM element is found, this is likely an external reference (xref).
       * External references have the format: #term:externalSpec:termName
       * 
       * THE allXTrefs DATA SOURCE:
       * -------------------------
       * The allXTrefs global variable is created during the build process by:
   * 1. src/pipeline/references/external-references-service.js - Orchestrates external reference collection
  * 2. src/pipeline/references/ - Fetches content from external GitHub specs
       * 3. The data is written to a JavaScript file and included in the page
       * 
       * DATA STRUCTURE:
       * allXTrefs = {
       *   xtrefs: [
       *     {
       *       externalSpec: "spec-name",     // The external specification identifier
       *       term: "term-name",             // The term being referenced
       *       content: "Definition text...",  // The definition content from external spec
       *       url: "https://...",            // Source URL
       *       // ... other metadata
       *     }
       *   ]
       * }
       * 
       * EXTERNAL SPEC FETCHING PROCESS:
       * ------------------------------
       * 1. External specs are defined in specs-configuration.yml
       * 2. During build, the system fetches HTML from external GitHub Pages
       * 3. Term definitions are extracted from the external HTML
       * 4. Content is cached in JSON and JS files for runtime use
       * 5. This allows tooltips to show definitions from other specifications
       */
      
      // Handle xref terms from allXTrefs data (when no DOM element found)
      const href = anchor.getAttribute('data-local-href') || '';
      
      /**
       * PARSE EXTERNAL REFERENCE FORMAT
       * ===============================
       * Expected format: #term:externalSpec:termName
       * Example: #term:KERI:delegator means:
       * - externalSpec: "KERI" 
       * - termName: "delegator"
       */
      const match = href.match(/#term:([^:]+):(.+)/);
      if (match) {
        const [, externalSpec, termName] = match;

        /**
         * LOOKUP IN EXTERNAL REFERENCES DATA
         * =================================
         * Search the global allXTrefs data for matching term.
         * Uses case-insensitive matching to handle inconsistencies
         * between how terms are defined vs. referenced.
         */
        if (typeof allXTrefs !== 'undefined' && allXTrefs.xtrefs && allXTrefs.xtrefs.length > 0) {
          // Look for term with case-insensitive matching to handle case inconsistencies
          const foundTerm = allXTrefs.xtrefs.find(xtref =>
            xtref.externalSpec === externalSpec &&
            xtref.term.toLowerCase() === termName.toLowerCase()
          );

          if (foundTerm && foundTerm.content) {
            /**
             * CLEAN HTML CONTENT FOR TOOLTIP
             * ==============================
             * The external content may contain HTML markup that's not suitable
             * for tooltips. We create a temporary DOM element to extract
             * clean text content while preserving structure.
             */
            // Strip HTML tags for clean text tooltip
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = foundTerm.content;
            tip.content = tempDiv.textContent || tempDiv.innerText || '';
          }
        }
      }
    }

    /**
     * CREATE AND STORE TOOLTIP
     * ========================
     * If we successfully extracted content (from either local DOM or external data),
     * create the actual tooltip using Tippy.js library and store it in our WeakMap
     * for future reference and duplicate prevention.
     * 
     * TIPPY.JS INTEGRATION:
     * - tippy() creates the interactive tooltip element
     * - WeakMap storage prevents memory leaks and duplicate creation
     * - Tooltip appears on hover and includes rich formatting
     */
    if (tip.content) {
      tipMap.set(anchor, tippy(anchor, tip))
    };
  }, { passive: true }); // passive: true improves scroll performance

  /**
   * MODULE SUMMARY
   * =============
   * This tooltip system provides contextual help for specification terms by:
   * 
   * 1. LISTENING: Uses event delegation to efficiently handle hover events
   * 2. IDENTIFYING: Determines if term is local (DOM-based) or external (xref)
   * 3. EXTRACTING: Gets content from appropriate source (DOM elements or allXTrefs data)
   * 4. DISPLAYING: Creates rich tooltips with Tippy.js
   * 5. CACHING: Prevents duplicate tooltip creation with WeakMap storage
   * 
   * CONTENT SOURCES:
   * - Local definitions: From <dt>/<dd> or table rows in current document
   * - External references: From allXTrefs global data (fetched during build)
   * 
   * MARKDOWN SYNTAX SUPPORTED:
   * - [[def: term, alias]] - Creates local definition
   * - [[tref: ., term, alias]] - References local term  
   * - [[tref: externalreference, term]] - References external term
   * - [[xref: externalreference, term]] - External reference (alias for tref)
   */

})();