/**
 * @file Main module for terminology section utility container functionality
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-08-31
 * @description Coordinates all terminology section utility container components
 */

/**
 * Initializes the complete terminology section utility container
 * This function coordinates all the components in the correct order
 */
function initializeTerminologyUtilityContainer() {
    // Check if the terms and definitions list exists
    const termsListElement = document.querySelector(".terms-and-definitions-list");
    const dtElements = termsListElement ? termsListElement.querySelectorAll("dt") : [];

    if (dtElements.length === 0) {
        // Hide the container if no terms exist
        hideShowUtilityContainer();
        return;
    }

    const terminologySectionUtilityContainer = document.getElementById("terminology-section-utility-container");
    
    // Build alphabet index data
    const alphabetIndex = {};
    dtElements.forEach(dt => {
        const span = dt.querySelector("span");
        if (span?.id) {
            const termId = span.id;
            const firstChar = termId.charAt(termId.indexOf("term:") + 5).toUpperCase();
            if (!alphabetIndex[firstChar]) {
                alphabetIndex[firstChar] = span.id;
            }
        }
    });

    /*************************************************/
    /* DOM CONSTRUCTION - COMPLETE LAYOUT STRUCTURE */
    /*************************************************/

    /* ===== ROW 1: ALPHABET INDEX ===== */
    // ALPHABET INDEX TEMPORARILY DISABLED
    // const alphabetRow = document.createElement("div");
    // alphabetRow.className = "row mb-2";
    // 
    // const alphabetCol = document.createElement("div");
    // alphabetCol.className = "col-12";
    // 
    // const alphabetIndexContainer = document.createElement("div");
    // alphabetIndexContainer.className = "d-flex flex-wrap justify-content-center gap-2";

    // // Create alphabet links
    // Object.keys(alphabetIndex).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(char => {
    //     const link = document.createElement("a");
    //     link.href = `#${alphabetIndex[char]}`;
    //     link.textContent = char;
    //     link.className = "btn btn-outline-secondary btn-sm";
    //     alphabetIndexContainer.appendChild(link);
    // });

    // alphabetCol.appendChild(alphabetIndexContainer);
    // alphabetRow.appendChild(alphabetCol);

    /* ===== ROW 2: UTILITIES (TERM COUNT + FILTERS + SEARCH) ===== */
    const utilityRow = document.createElement("div");
    utilityRow.className = "row g-2";
    utilityRow.id = "utility-row";
    
    // Left column: Term count
    const leftCol = document.createElement("div");
    leftCol.className = "col-auto d-flex align-items-center";

    // Term count
    const numberOfTerms = document.createElement("small");
    numberOfTerms.className = "text-muted mb-0";
    numberOfTerms.textContent = `${dtElements.length} terms`;
    leftCol.appendChild(numberOfTerms);

    // Center column: Filters and Versions button
    const centerCol = document.createElement("div");
    centerCol.className = "col d-flex flex-wrap align-items-center gap-3";

    // Filter checkboxes container
    const checkboxesContainer = document.createElement('div');
    checkboxesContainer.className = 'd-flex gap-3';
    
    // Local terms checkbox
    const localTermsCheckboxDiv = document.createElement('div');
    localTermsCheckboxDiv.className = 'form-check';
    localTermsCheckboxDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" id="showLocalTermsCheckbox" checked>
        <label class="form-check-label" for="showLocalTermsCheckbox">
            Local
        </label>
    `;
    
    // External terms checkbox
    const externalTermsCheckboxDiv = document.createElement('div');
    externalTermsCheckboxDiv.className = 'form-check';
    externalTermsCheckboxDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" id="showExternalTermsCheckbox" checked>
        <label class="form-check-label" for="showExternalTermsCheckbox">
            Remote
        </label>
    `;
    
    checkboxesContainer.appendChild(localTermsCheckboxDiv);
    checkboxesContainer.appendChild(externalTermsCheckboxDiv);
    centerCol.appendChild(checkboxesContainer);

    // Snapshot link
    const snapshotLink = document.createElement('a');
    snapshotLink.id = 'snapshot-link-in-content';
    snapshotLink.className = 'btn btn-outline-primary btn-sm';
    // snapshotLink.href = './versions/';
    snapshotLink.href = '#';
    snapshotLink.textContent = 'Versions';
    centerCol.appendChild(snapshotLink);

    // Right column: Search
    const rightCol = document.createElement("div");
    rightCol.className = "col-auto d-flex justify-content-end";

    // Search container
    const searchContainer = document.createElement("div");
    searchContainer.setAttribute("id", "container-search");
    searchContainer.classList.add("input-group", "input-group-sm");
    searchContainer.setAttribute("role", "search");

    // Search input
    const searchInput = document.createElement("input");
    searchInput.setAttribute("type", "text");
    searchInput.setAttribute("id", "search");
    searchInput.classList.add("form-control");
    searchInput.setAttribute("placeholder", "🔍 (terms only)");
    searchInput.setAttribute("aria-label", "Search terms");
    searchInput.setAttribute("autocomplete", "off");
    searchContainer.appendChild(searchInput);

    // Search button group
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("input-group-text", "p-0");

    // Previous match button
    const goToPreviousMatchButton = document.createElement("button");
    goToPreviousMatchButton.setAttribute("id", "one-match-backward-search");
    goToPreviousMatchButton.classList.add("btn", "btn-outline-secondary");
    goToPreviousMatchButton.setAttribute("type", "button");
    goToPreviousMatchButton.setAttribute("disabled", "true");
    goToPreviousMatchButton.setAttribute("title", "Go to previous match (Left Arrow)");
    goToPreviousMatchButton.setAttribute("aria-label", "Go to previous match");
    goToPreviousMatchButton.innerHTML = '<span aria-hidden="true">▲</span>';
    buttonGroup.appendChild(goToPreviousMatchButton);

    // Next match button
    const goToNextMatchButton = document.createElement("button");
    goToNextMatchButton.setAttribute("id", "one-match-forward-search");
    goToNextMatchButton.classList.add("btn", "btn-outline-secondary");
    goToNextMatchButton.setAttribute("type", "button");
    goToNextMatchButton.setAttribute("disabled", "true");
    goToNextMatchButton.setAttribute("title", "Go to next match (Right Arrow)");
    goToNextMatchButton.setAttribute("aria-label", "Go to next match");
    goToNextMatchButton.innerHTML = '<span aria-hidden="true">▼</span>';
    buttonGroup.appendChild(goToNextMatchButton);

    // Matches counter
    const totalMatchesSpan = document.createElement("span");
    totalMatchesSpan.setAttribute("id", "total-matches-search");
    totalMatchesSpan.classList.add("input-group-text");
    totalMatchesSpan.innerHTML = "0 matches";
    totalMatchesSpan.setAttribute("aria-live", "polite");
    totalMatchesSpan.setAttribute("role", "status");
    searchContainer.appendChild(totalMatchesSpan);

    searchContainer.appendChild(buttonGroup);
    rightCol.appendChild(searchContainer);

    utilityRow.appendChild(leftCol);
    utilityRow.appendChild(centerCol);
    utilityRow.appendChild(rightCol);

    /* ===== ASSEMBLE COMPLETE STRUCTURE ===== */
    // ALPHABET INDEX TEMPORARILY DISABLED
    // terminologySectionUtilityContainer.appendChild(alphabetRow);
    terminologySectionUtilityContainer.appendChild(utilityRow);

    /*****************************************/
    /* INITIALIZE FUNCTIONALITY COMPONENTS  */
    /*****************************************/

    // Initialize functionalities (these will attach to the DOM elements we just created)
    // ALPHABET INDEX TEMPORARILY DISABLED
    // attachAlphabetIndexFunctionality();
    attachTermFilterFunctionality(checkboxesContainer);
    attachSearchFunctionality(searchInput, goToPreviousMatchButton, goToNextMatchButton, totalMatchesSpan);
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
    initializeTerminologyUtilityContainer();
});
