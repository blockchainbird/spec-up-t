/**
 * @fileoverview Manages collapsible definition lists with visual state indicators.
 * @author Kor Dwarshuis
 * @version 1.0.1
 * @updated 2025-10-02 - Refactored to use centralized button container utilities
 * @description This module provides functionality to toggle the visibility
 * of definition descriptions in a document with a smooth user experience.
 * It creates interactive buttons with three toggle states and prevents
 * UI jumping during transitions using fixed positioning and requestAnimationFrame.
 * @requires insert-trefs.js - For the initializeOnTrefsInserted helper function
 * @requires definition-button-container-utils.js - For the addButtonToContainer utility function
 */

/**
 * Sets up collapsible definition lists with toggle buttons.
 * Handles the creation of buttons, event listeners, and visibility states.
 * This is the main initialization function that's called when the DOM is ready
 * and all transcluded references have been inserted.
 * @function
 * @see initializeOnTrefsInserted - Helper function that ensures this runs at the right time
 */
function collapseDefinitions() {
    /**
     * Queries and categorizes definition list elements in the DOM.
     * @function
     * @returns {Object} Object containing categorized DOM element collections
     * @returns {NodeList} returns.dds - All definition descriptions
     * @returns {NodeList} returns.dts - All definition terms
     * @returns {Array<Element>} returns.regularDds - Standard definition descriptions
     * @returns {Array<Element>} returns.specialDds - Special definition descriptions (e.g., "See also", "Source")
     */
    function queryElements() {
        const dds = document.querySelectorAll('#content dl.terms-and-definitions-list > dd');
        const dts = document.querySelectorAll('#content dl.terms-and-definitions-list > dt');
        const regularDds = Array.from(dds).filter(dd => !isSpecialDefinition(dd.textContent.trim()));
        const specialDds = Array.from(dds).filter(dd => isSpecialDefinition(dd.textContent.trim()));

        return { dds, dts, regularDds, specialDds };
    }

    let { dds, dts, regularDds, specialDds } = queryElements();
    const buttonTitleText = 'Change how much info is shown';

    /**
     * Determines if a definition is a special type (e.g., a "See also" or "Source" note)
     * @param {string} content - The content of the definition to check
     * @returns {boolean} True if the content starts with a special prefix
     */
    function isSpecialDefinition(content) {
        const definitionHidePrefixes = [
            "Source",
            "See also",
            "More in",
            "Also see",
            "See:",
            "See also",
            "See more",
            "See more in",
            "See more about",
            "See more on",
            "See more at",
            "More:",
            "Note:",
            "Paraphrased by",
            "Beware:",
            "eSSIF-Lab: ",
            "W3C VC:",
            "NIST:",
            "Supporting definitions:"
        ];
        return definitionHidePrefixes.some(prefix => content.startsWith(prefix));
    }

    specialDds.forEach(dd => {
        dd.classList.add('terms-def-extra-info');
    });

    /**
     * Toggles the visibility state of definitions across the document.
     * Cycles through three visibility states:
     * - State 0: All definitions hidden
     * - State 1: Only regular definitions visible
     * - State 2: All definitions visible
     * 
     * Updates UI indicators to reflect the current state.
     * @function
     */
    function toggleVisibility() {
        const buttons = document.querySelectorAll('.collapse-all-defs-button');
        const currentState = parseInt(buttons[0].dataset.state || 0);
        // Cycle through 3 states: 0 (all hidden), 1 (only regular visible), 2 (all visible)
        const newState = (currentState + 1) % 3;

        // Update state based on newState
        switch (newState) {
            case 0: // All definitions hidden
                dds.forEach(dd => {
                    dd.classList.add('hidden');
                    dd.classList.remove('visible');
                });
                buttons.forEach(button => {
                    button.dataset.state = 0;
                    button.title = 'Show basic definitions';
                    // Update which state indicator is active
                    button.querySelectorAll('.state-indicator').forEach(indicator => {
                        if (parseInt(indicator.dataset.state) === 0) {
                            indicator.classList.add('active');
                        } else {
                            indicator.classList.remove('active');
                        }
                    });
                });
                document.querySelector('html').classList.add('defs-hidden');
                break;

            case 1: // Only regular definitions visible
                regularDds.forEach(dd => {
                    dd.classList.remove('hidden');
                    dd.classList.add('visible');
                });
                specialDds.forEach(dd => {
                    dd.classList.add('hidden');
                    dd.classList.remove('visible');
                });
                buttons.forEach(button => {
                    button.dataset.state = 1;
                    button.title = 'Show all definitions';
                    // Update which state indicator is active
                    button.querySelectorAll('.state-indicator').forEach(indicator => {
                        if (parseInt(indicator.dataset.state) === 1) {
                            indicator.classList.add('active');
                        } else {
                            indicator.classList.remove('active');
                        }
                    });
                });
                document.querySelector('html').classList.remove('defs-hidden');
                break;

            case 2: // All definitions visible
                dds.forEach(dd => {
                    dd.classList.remove('hidden');
                    dd.classList.add('visible');
                });
                specialDds.forEach(dd => {
                    dd.classList.add('terms-def-extra-info');
                });
                buttons.forEach(button => {
                    button.dataset.state = 2;
                    button.title = 'Hide all definitions';
                    // Update which state indicator is active
                    button.querySelectorAll('.state-indicator').forEach(indicator => {
                        if (parseInt(indicator.dataset.state) === 2) {
                            indicator.classList.add('active');
                        } else {
                            indicator.classList.remove('active');
                        }
                    });
                });
                document.querySelector('html').classList.remove('defs-hidden');
                break;
        }
    }

    /**
     * Creates and appends toggle buttons to all definition terms.
     * Creates or reuses a button container and adds the collapse button to it.
     * Each button contains state indicators for the three visibility states,
     * and is initialized to show all definitions (state 2).
     * @function
     */
    function addButtons() {
        dts.forEach(dt => {
            // Check if button already exists to avoid duplicates
            if (dt.querySelector('.collapse-all-defs-button')) {
                return; // Skip if button already exists
            }

            const button = document.createElement('button');
            button.classList.add('collapse-all-defs-button', 'btn-outline-secondary', 'd-print-none', 'btn', 'p-0', 'fs-5', 'd-flex', 'align-items-center', 'justify-content-center');
            // Create a container for all three state indicators
            button.innerHTML = `<span class="state-indicator" data-state="0">①</span><span class="state-indicator" data-state="1">②</span><span class="state-indicator" data-state="2">③</span>`;
            button.setAttribute('id', 'toggleButton');
            button.setAttribute('title', buttonTitleText);
            button.setAttribute('data-state', '2'); // Start with all definitions visible

            // Set initial active state
            button.querySelector('.state-indicator[data-state="2"]').classList.add('active');

            // Use the centralized utility to add the button to the container
            // Prepend=false (default) ensures collapse button appears after meta-info button
            addButtonToContainer(dt, button);
        });
    }

    // Initial button setup
    addButtons();

    /**
     * Handles click events on definition toggle buttons and their state indicators.
     * Uses advanced positioning techniques to prevent UI jumping during transitions:
     * 1. Temporarily fixes the button's position using position:fixed during DOM updates
     * 2. Uses requestAnimationFrame for optimal timing of position restoration
     * 3. Precisely adjusts scroll position to maintain visual stability
     * 
     * This prevents the visual disruption that would otherwise occur when expanding
     * or collapsing definitions causes layout reflow.
     * 
     * @param {Event} event - The DOM click event
     */
    document.addEventListener('click', event => {
        // Check if the click is on a state-indicator or the button itself
        if (event.target.classList.contains('collapse-all-defs-button') ||
            event.target.classList.contains('state-indicator')) {
            // Get the button element (whether clicked directly or via child)
            const button = event.target.classList.contains('collapse-all-defs-button') ?
                event.target :
                event.target.closest('.collapse-all-defs-button');

            // Get button's position in viewport and page
            const buttonRect = button.getBoundingClientRect();

            // Apply a class to prevent layout shifts during transition
            document.documentElement.classList.add('definitions-transitioning');

            /**
             * Button position anchoring technique:
             * 1. Fix the button in its current viewport position to ensure 
             *    it doesn't move during DOM reflow
             * 2. Apply fixed positioning with the exact same coordinates
             * 3. After DOM changes, restore normal positioning and adjust scroll
             */
            button.style.position = 'fixed';
            button.style.top = `${buttonRect.top}px`;
            button.style.right = `${window.innerWidth - buttonRect.right}px`;
            button.style.zIndex = '1000';

            // Toggle visibility which might change layout
            toggleVisibility();

            /**
             * Visual stability restoration:
             * Use requestAnimationFrame to restore normal positioning at the optimal time
             * after DOM updates, when the browser is ready to paint the next frame.
             * This provides better timing than setTimeout for visual operations.
             */
            requestAnimationFrame(() => {
                // Remove fixed positioning
                button.style.position = '';
                button.style.top = '';
                button.style.right = '';
                button.style.zIndex = '';

                // Remove the transitioning class
                document.documentElement.classList.remove('definitions-transitioning');

                // Scroll to correct position so the button appears where it was fixed
                const newButtonRect = button.getBoundingClientRect();

                // Calculate and apply precise scroll adjustment to maintain visual position
                window.scrollTo({
                    top: window.scrollY + (newButtonRect.top - buttonRect.top),
                    behavior: 'instant'
                });
            });
        }
    });
}

/**
 * Initialize the collapsible definitions functionality when the DOM is fully loaded.
 * We listen for a custom event from insert-trefs.js to know exactly when all
 * external references have been inserted into the DOM.
 * @listens DOMContentLoaded - Standard DOM event fired when initial HTML document is completely loaded
 * @listens trefs-inserted - Custom event fired by insert-trefs.js when all term references are processed
 * @see initializeOnTrefsInserted - Helper function that manages initialization timing
 */
document.addEventListener("DOMContentLoaded", function () {
    initializeOnTrefsInserted(collapseDefinitions);
});