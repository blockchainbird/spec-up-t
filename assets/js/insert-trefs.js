/**
 * @fileoverview Handles the insertion of transcluded external references (trefs) into HTML documentation.
 * This script processes terms marked with a specific class and adds their definitions from external sources.
 * The terms come from external repositories and are inserted into the document as collapsible definitions.
 */

/**
 * Inserts transcluded external references (trefs) into the document.
 * This function processes the allXTrefs data and inserts definition content into the document
 * for terms marked with the 'transcluded-xref-term' class.
 * @param {Object} allXTrefs - The object containing all external references data
 * @param {Array} allXTrefs.xtrefs - Array of external reference objects, each containing term definitions
 */
function insertTrefs(allXTrefs) {
   /**
    * Processes all terms found in the document and collects DOM changes
    * before applying them in batch to improve performance.
    * 
    * @param {Object} xtrefsData - The object containing xtrefs data
    * @param {Array} xtrefsData.xtrefs - Array of external reference objects
    * @returns {void} - This function does not return a value but dispatches a 'trefs-inserted' event
    * when all DOM modifications are complete
    */
   function processTerms(xtrefsData) {
      /**
       * First collect all terms to ensure consistent processing order
       * @type {Array<{element: Element, textContent: string, dt: Element, parent: Element}>}
       */
      const allTerms = [];

      document.querySelectorAll('dl.terms-and-definitions-list dt span.transcluded-xref-term').forEach((termElement) => {
         // Get the full text content including any nested spans (for aliases)
         const textContent = termElement.textContent.trim();

         // Find the dt element once outside the loop
         const dt = termElement.closest('dt');

         // Skip if the term has already been processed
         if (dt) {
            const nextElement = dt.nextElementSibling;
            if (nextElement?.classList.contains('transcluded-xref-term') &&
               nextElement.classList.contains('meta-info-content-wrapper')) {
               return; // Already processed
            }
         }

         // Only add terms that haven't been processed yet
         allTerms.push({
            element: termElement,
            textContent: textContent,
            dt: dt,
            parent: dt?.parentNode
         });
      });

      /**
       * Prepare all DOM changes first before making any insertions
       * Each item in the array contains the elements needed for DOM insertion
       * @type {Array<{dt: Element, parent: Element, fragment: DocumentFragment}>}
       */
      const domChanges = allTerms.map(termData => {
         const { textContent, dt, parent } = termData;

         if (!dt || !parent) {
            return null; // Skip invalid entries
         }

         // Find the first matching xref to avoid duplicates
         const xref = xtrefsData.xtrefs.find(x => x.term === textContent);

         // Create a DocumentFragment to hold all new elements for this term
         const fragment = document.createDocumentFragment();

         // Create meta info element
         const metaInfoEl = document.createElement('dd');
         metaInfoEl.classList.add('transcluded-xref-term', 'meta-info-content-wrapper', 'collapsed');

         if (xref) {
            // Generate meta info content
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
            metaInfoEl.innerHTML = md.render(metaInfo);
            fragment.appendChild(metaInfoEl);

            // Clean up markdown content
            let content = xref.content
               .replace(/\[\[def:[^\]]*?\]\]/g, '') // Remove [[def: ...]] patterns regardless of trailing chars
               .split('\n')
               .map(line => line.replace(/^\s*~\s*/, '')) // Remove leading ~ and spaces
               .join('\n')
               .replace(/\[\[ref:/g, '') // Remove [[ref: ...]]
               .replace(/\]\]/g, '');

            // Parse the rendered HTML to check for dd elements
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = md.render(content);

            // If there are dd elements in the rendered content, prepare them for insertion
            const ddElements = tempDiv.querySelectorAll('dd');
            if (ddElements.length > 0) {
               // Add all dd elements to the fragment in original order
               Array.from(ddElements).forEach(dd => {
                  // Clone the node to avoid removing it from tempDiv during insertion
                  const clonedDD = dd.cloneNode(true);
                  // Add necessary classes
                  clonedDD.classList.add('transcluded-xref-term', 'transcluded-xref-term-embedded');
                  // Add to fragment
                  fragment.appendChild(clonedDD);
               });
            } else {
               // No dd elements found, create one to hold the content
               const contentEl = document.createElement('dd');
               contentEl.classList.add('transcluded-xref-term', 'transcluded-xref-term-embedded');
               contentEl.innerHTML = tempDiv.innerHTML;
               fragment.appendChild(contentEl);
            }
         } else {
            // Handle case where xref is not found
            metaInfoEl.innerHTML = md.render(`
| Property | Value |
| -------- | ----- |
| Owner | Unknown |
| Repo | Unknown |
| Commit hash | not found |
            `);
            fragment.appendChild(metaInfoEl);

            // Create not found message
            const notFoundEl = document.createElement('dd');
            notFoundEl.classList.add('transcluded-xref-term', 'transcluded-xref-term-embedded', 'last-dd');
            notFoundEl.innerHTML = '<p>This term was not found in the external repository.</p>';
            fragment.appendChild(notFoundEl);
         }

         // Return all necessary information for DOM insertion
         return {
            dt: dt,
            parent: parent,
            fragment: fragment
         };
      }).filter(Boolean); // Remove null entries

      /**
       * Perform all DOM insertions in a single batch using requestAnimationFrame
       * to optimize browser rendering and prevent layout thrashing
       */
      requestAnimationFrame(() => {
         domChanges.forEach(change => {
            const { dt, parent, fragment } = change;
            parent.insertBefore(fragment, dt.nextSibling);
         });

         // Dispatch a custom event when all DOM modifications are complete
         // This allows other scripts to know exactly when our work is done
         /**
          * Dispatches a custom event to signal that trefs insertion is complete
          * @fires trefs-inserted
          */
         document.dispatchEvent(new CustomEvent('trefs-inserted', {
            detail: { count: domChanges.length }
         }));
      });
   }

   if (allXTrefs?.xtrefs) {
      processTerms(allXTrefs);
   } else {
      console.error('allXTrefs is undefined or missing xtrefs property');
      // Dispatch event even when there are no xrefs, so waiting code knows we're done
      document.dispatchEvent(new CustomEvent('trefs-inserted', {
         detail: { count: 0, error: 'Missing xtrefs data' }
      }));
   }
}

/**
 * Handles the initialization of collapsible definitions functionality.
 * This function sets up event listeners for the 'trefs-inserted' event and 
 * provides a fallback initialization mechanism if the event is never fired.
 * @param {Function} initCallback - The function to call when initialization should occur
 * @returns {void} - This function does not return a value
 */
function initializeOnTrefsInserted(initCallback) {
   // Track initialization state
   let hasInitialized = false;

   // Set up the event listener for the custom event from insert-trefs.js
   document.addEventListener('trefs-inserted', function (event) {
      // Avoid double initialization
      if (hasInitialized) return;

      // Now we know for certain that insert-trefs.js has completed its work
      hasInitialized = true;
      initCallback();

      // Log info about the completed xrefs insertion (useful for debugging)
      if (event.detail) {
         console.log(`Collapsible definitions initialized after ${event.detail.count} xrefs were inserted`);
      }
   });

   // Fallback initialization in case insert-trefs.js doesn't run or doesn't emit the event
   // This ensures our UI works even if there's an issue with xrefs processing
   // or if the 'trefs-inserted' event is never dispatched for some reason

   // Wait for a reasonable time, then check if we've initialized
   setTimeout(() => {
      if (!hasInitialized) {
         console.warn('trefs-inserted event was not received, initializing collapsible definitions anyway');
         initCallback();
         hasInitialized = true;
      }
   }, 1000); // Longer timeout as this is just a fallback
}

/**
 * Initialize the transcluded references when the DOM is fully loaded.
 * Checks for the global allXTrefs object and calls insertTrefs if available.
 * This event listener ensures that the DOM is ready before attempting to process references.
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
   // Check if allXTrefs is defined in the global scope
   if (typeof allXTrefs !== 'undefined') {
      insertTrefs(allXTrefs);
   } else {
      console.warn('allXTrefs is not available in the global scope. Transcluded references will not be inserted.');
   }
});

