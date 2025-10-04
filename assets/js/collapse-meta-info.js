/**
 * @file This file creates a collapsible meta info section for each term definition on the page. It is used to hide meta information about a term definition by default and show it when the user clicks the button.
 * @author Kor Dwarshuis
 * @version 0.0.3
 * @since 2025-02-16
 * @updated 2025-10-02 - Refactored to use centralized button container utilities
 * @requires definition-button-container-utils.js - For the addButtonToContainer utility function
 */

/**
 * Creates a toggle button for collapsible meta information sections.
 * Creates or reuses a button container and adds the meta-info button to it.
 * @function createToggleButton
 * @param {HTMLElement} element - The DD element that contains the meta information
 * @returns {void}
 */
function createToggleButton(element) {
    const toggleButton = document.createElement('button');
    toggleButton.classList.add('meta-info-toggle-button', 'btn', 'fs-1', 'd-flex', 'align-items-center','justify-content-center');
    toggleButton.innerHTML = '<i class="bi bi-info-circle" style="margin-top: -0.5em;"></i>';
    toggleButton.title = 'Meta info';

    // Add event listener to the button
    toggleButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Get the wrapper containing the meta info
        const isCollapsed = element.classList.contains('collapsed');

        // Toggle the collapsed state
        if (isCollapsed) {
            // If collapsed, expand it
            element.classList.remove('collapsed');
            // Force reflow to ensure transition works properly
            element.getBoundingClientRect();
        } else {
            // If expanded, collapse it
            element.classList.add('collapsed');
        }
    });

    // Find the closest <dt> sibling
    let dtElement = element.previousElementSibling;
    while (dtElement && dtElement.tagName !== 'DT') {
        dtElement = dtElement.previousElementSibling;
    }
    
    if (dtElement) {
        // Use the centralized utility to add the button to the container
        // Prepend=true ensures meta-info button appears first
        addButtonToContainer(dtElement, toggleButton, true);
    } else {
        // Fallback to inserting at the top right of the element if no <dt> is found
        element.insertBefore(toggleButton, element.firstChild);
    }
}


/**
 * Finds all description list items (dd) that contain tables and makes them collapsible.
 * Adds necessary wrapper elements and toggle buttons to create the collapsible UI.
 * @function collapseMetaInfo
 * @returns {void}
 */
function collapseMetaInfo() {
    const collapsibles = document.querySelectorAll('dl > dd:has(table)');

    collapsibles.forEach(function (element) {
        // Add meta-info-content-wrapper class
        element.classList.add('meta-info-content-wrapper');

        // Wrap content in a div for proper spacing
        const wrapper = document.createElement('div');
        wrapper.classList.add('meta-info-inner-wrapper');

        // Move all children except potential existing buttons into wrapper
        while (element.firstChild && element.firstChild !== element.querySelector('.meta-info-toggle-button')) {
            wrapper.appendChild(element.firstChild);
        }

        if (!element.querySelector('.meta-info-toggle-button')) { // Check if already has a button
            createToggleButton(element);
        }

        element.appendChild(wrapper);

        // Collapse by default on load
        element.classList.add('collapsed');
    });
}


/**
 * Initialize the collapse meta info functionality when the DOM is fully loaded.
 * We use the initializeOnTrefsInserted helper from insert-trefs.js to ensure our 
 * functionality runs at the right time - either after all external references have
 * been inserted, or after a timeout if the event isn't triggered.
 * 
 * @listens DOMContentLoaded - Initial event when DOM is ready
 * @listens trefs-inserted - Custom event from insert-trefs.js when all external references are inserted
 * @see initializeOnTrefsInserted - Helper function that manages initialization timing
 */
document.addEventListener("DOMContentLoaded", function () {
    initializeOnTrefsInserted(collapseMetaInfo);
});

