/**
 * @file Term filter functionality
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-08-31
 * @description Handles Local/Remote term filtering logic (DOM is constructed in main module)
 */

/**
 * Attaches functionality to the term filter checkboxes
 * @param {HTMLElement} checkboxesContainer - The container with the checkboxes
 * @returns {void}
 */
function attachTermFilterFunctionality(checkboxesContainer) {
    // Check if the terms and definitions list exists
    const termsListElement = document.querySelector(".terms-and-definitions-list");
    const dtElements = termsListElement ? termsListElement.querySelectorAll("dt") : [];

    if (dtElements.length === 0) {
        return;
    }

    // Add event listeners to checkboxes (generic for any number of checkboxes)
    function enforceAtLeastOneChecked(event) {
        const checkboxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]');
        const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
        // If the user is unchecking a box
        if (!event.target.checked) {
            // If all others are already unchecked (so this would make all unchecked except the one being unchecked)
            if (checkedBoxes.length === 0) {
                // Check all other checkboxes except the one being unchecked
                checkboxes.forEach(cb => {
                    if (cb !== event.target) {
                        cb.checked = true;
                    }
                });
                // The one being unchecked remains unchecked
            }
        }
        // Toggle classes for each checkbox type
        checkboxes.forEach(cb => {
            const html = document.querySelector('html');
            if (cb.id === 'showLocalTermsCheckbox') {
                html.classList.toggle('hide-local-terms', !cb.checked);
            } else if (cb.id === 'showExternalTermsCheckbox') {
                html.classList.toggle('hide-external-terms', !cb.checked);
            }
            // Add more else ifs here for future checkboxes
        });
    }

    // Attach the handler to all checkboxes in the container
    checkboxesContainer.addEventListener('change', function(event) {
        if (event.target.matches('input[type="checkbox"]')) {
            enforceAtLeastOneChecked(event);
        }
    });
}
