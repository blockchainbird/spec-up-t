/**
 * @fileoverview Inserts transcluded external references (trefs) into the document.
 *
 * This script enhances an HTML document by adding definitions and meta information
 * for terms marked with `<span class="transcluded-xref-term">` inside `<dt>` elements
 * within a `<dl>` structure. It matches these terms against an external data source,
 * renders the corresponding content and meta information from markdown to HTML,
 * and inserts them as `<dd>` elements following each matching `<dt>`. The script
 * executes automatically when the DOM is fully loaded via a `DOMContentLoaded` event listener.
 *
 * ### Dependencies
 * - **`allXTrefs`**: A global object containing the external references to be transcluded.
 * - **`md`**: A markdown renderer object with a `render` method to convert markdown to HTML.
 *
 * ### Data Structure
 * The `allXTrefs` object must have the following structure:
 * ```javascript
 * {
 *   xtrefs: [
 *     {
 *       term: string,          // The term to match against the <span> text content
 *       content: string,       // Markdown content for the definition
 *       owner: string,         // Owner of the source repository
 *       repo: string,          // Repository name
 *       repoUrl: string,       // URL to the repository
 *       commitHash: string,    // Commit hash of the source
 *       avatarUrl: string      // URL to the owner's avatar
 *     },
 *     // Additional reference objects...
 *   ]
 * }
 * ```
 *
 * ### Behavior
 * The script:
 * 1. Identifies all `<dt>` elements containing `<span class="transcluded-xref-term">`.
 * 2. Extracts the text content of each `<span>`.
 * 3. Searches for a matching `term` in `allXTrefs.xtrefs`.
 * 4. If a match is found, creates:
 *    - A `<dd>` element with the rendered `content` (markdown to HTML).
 *    - A `<dd>` element with meta information (e.g., owner, repo, commit hash) also rendered from markdown.
 * 5. Inserts these `<dd>` elements after the corresponding `<dt>`.
 *
 * ### DOM Modifications
 * The script modifies the DOM by appending new `<dd>` elements after each matching `<dt>`.
 *
 * @requires {Object} allXTrefs - The external data source containing the references.
 * @requires {Object} md - A markdown renderer with a `render` method (e.g., marked.js or similar).
 *
 * @example
 * // Define dependencies in a <script> tag before this script:
 * window.allXTrefs = {
 *   xtrefs: [
 *     {
 *       term: "example",
 *       content: "This is an **example** definition.",
 *       owner: "user",
 *       repo: "glossary",
 *       repoUrl: "https://github.com/user/glossary",
 *       commitHash: "abc123",
 *       avatarUrl: "https://github.com/user.png"
 *     }
 *   ]
 * };
 * window.md = { render: function(markdown) { return "<p>" + markdown + "</p>"; } };
 *
 * // HTML example:
 * // <dl>
 * //   <dt><span class="transcluded-xref-term">example</span></dt>
 * // </dl>
 * // After script execution:
 * // <dl>
 * //   <dt><span class="transcluded-xref-term">example</span></dt>
 * //   <dd> … table with meta info … </dd>
 * //   <dd><p>This is an <strong>example</strong> definition.</p></dd>
 * // </dl>
 */

function insertTrefs(allXTrefs) { // Pass allXTrefs as a parameter
   function processTerms(xtrefsData) {
      const termElements = document.querySelectorAll('dt span.transcluded-xref-term');

      termElements.forEach(termElement => {
         // Get the text content of the element, excluding its child nodes
         const textContent = Array.from(termElement.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join('');

         // Find the first matching xref to avoid duplicates
         const xref = xtrefsData.xtrefs.find(x => x.term === textContent);
         if (!xref) return; // Skip if no match

         // Create definition <dd>
         const ddTrefDef = document.createElement('dd');
         ddTrefDef.classList.add('transcluded-xref-term', 'transcluded-xref-term-embedded');

         // Clean up markdown content
         let content = xref.content
            .replace(/\[\[def:[^\]]*?\]\]/g, '') // Remove [[def: ...]] patterns regardless of trailing chars
            .split('\n')
            .map(line => line.replace(/^\s*~\s*/, '')) // Remove leading ~ and spaces
            .join('\n')
            .replace(/\[\[ref:/g, '') // Remove [[ref: ...]]
            .replace(/\]\]/g, '');

         ddTrefDef.innerHTML = md.render(content);

         // Create meta info <dd>
         const ddMetaInfo = document.createElement('dd');
         ddMetaInfo.classList.add('transcluded-xref-term', 'meta-info-content-wrapper');

         // Handle missing xref properties
         const avatar = xref.avatarUrl ? `![avatar](${xref.avatarUrl})` : '';
         const owner = xref.owner || 'Unknown';
         const repo = xref.repo && xref.repoUrl ? `[${xref.repo}](${xref.repoUrl})` : 'Unknown';
         const commitHash = xref.commitHash || 'Unknown';

         const metaInfo = `
| Property | Value |
| -------- | ----- |
| Owner | ${avatar} ${owner} |
| Repo | ${repo} |
| Commit hash | ${commitHash} |
         `;
         ddMetaInfo.innerHTML = md.render(metaInfo);

         // Insert both <dd> elements in the correct order
         const dt = termElement.closest('dt');
         if (dt) {
            const parent = dt.parentNode;
            parent.insertBefore(ddMetaInfo, dt.nextSibling); // Meta info first
            parent.insertBefore(ddTrefDef, ddMetaInfo.nextSibling); // Definition second
         }
      });
   }

   if (allXTrefs && allXTrefs.xtrefs) {
      processTerms(allXTrefs);
   } else {
      console.error('allXTrefs is undefined or missing xtrefs property');
   }
}

document.addEventListener('DOMContentLoaded', () => {
   // Assuming allXTrefs is available globally or fetched elsewhere
   insertTrefs(allXTrefs); // Adjust based on how allXTrefs is provided
});