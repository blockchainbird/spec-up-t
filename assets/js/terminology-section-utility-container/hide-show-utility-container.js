/**
 * @file Hides the utility container when no terms exist
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-08-31
 * @description Removes the utility container if no terms and definitions are present
 */

/**
 * Hides the utility container if no terms exist
 * @returns {void}
 */
function hideShowUtilityContainer() {
    // Check if the terms and definitions list exists
    const termsListElement = document.querySelector(".terms-and-definitions-list");
    const dtElements = termsListElement ? termsListElement.querySelectorAll("dt") : [];

    if (dtElements.length === 0) {
        document.getElementById("terminology-section-utility-container")?.remove();
    }
}
