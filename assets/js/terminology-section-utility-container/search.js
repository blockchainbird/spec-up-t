/**
 * @file Search functionality for terminology section
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-08-31
 * @description Handles search logic and highlighting (DOM is constructed in main module)
 */

/**
 * Attaches search functionality to the provided DOM elements
 * @param {HTMLInputElement} searchInput - The search input element
 * @param {HTMLButtonElement} goToPreviousMatchButton - Previous match button
 * @param {HTMLButtonElement} goToNextMatchButton - Next match button
 * @param {HTMLSpanElement} totalMatchesSpan - Matches counter element
 * @returns {void}
 */
function attachSearchFunctionality(searchInput, goToPreviousMatchButton, goToNextMatchButton, totalMatchesSpan) {
    // Check if the terms and definitions list exists
    const termsListElement = document.querySelector(".terms-and-definitions-list");
    const dtElements = termsListElement ? termsListElement.querySelectorAll("dt") : [];

    if (dtElements.length === 0) {
        return;
    }

    /*****************/
    /* CONFIGURATION */
    const matchesStyle = specConfig.searchHighlightStyle || 'ssi';
    const debounceTime = 600;
    const matches = 'matches';
    const searchableContent = document.querySelector('.terms-and-definitions-list');

    // Styling of search matches
    const matchesStyleSelector = {
        dif: 'highlight-matches-DIF-search',
        toip: 'highlight-matches-ToIP-search',
        btc: 'highlight-matches-BTC-search',
        keri: 'highlight-matches-KERI-search',
        ssi: 'highlight-matches-SSI-search',
        gleif: 'highlight-matches-GLEIF-search'
    };

    const matchesClassName = "highlight-matches-search";
    const matchesStyleSelectorClassName = matchesStyleSelector[matchesStyle.toLowerCase()];
    
    let totalMatches = 0;
    let activeMatchIndex = -1;
    let debounceTimeout;

    /* Helper functions */
    function setTotalMatches() {
        totalMatches = document.querySelectorAll('.' + matchesClassName).length;
        totalMatchesSpan.innerHTML = `${totalMatches} ${matches}`;
    }

    function handleBackAndForthButtonsDisabledState() {
        const hasMatches = totalMatches > 0;
        goToPreviousMatchButton.disabled = !hasMatches;
        goToNextMatchButton.disabled = !hasMatches;
    }

    function scrollToElementCenter(element) {
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function removeHighlights() {
        const highlighted = document.querySelectorAll('.' + matchesClassName);
        highlighted.forEach(element => {
            const parent = element.parentNode;
            parent.replaceChild(document.createTextNode(element.textContent), element);
            parent.normalize();
        });
    }

    function highlightMatches(query) {
        if (!query.trim()) {
            removeHighlights();
            setTotalMatches();
            handleBackAndForthButtonsDisabledState();
            return;
        }

        removeHighlights();
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
        
        function searchNodes(node) {
            if (node.nodeType === 3) { // Text node
                const text = node.textContent;
                if (regex.test(text)) {
                    const fragments = document.createDocumentFragment();
                    let lastIndex = 0;
                    let match;
                    
                    regex.lastIndex = 0; // Reset regex
                    while ((match = regex.exec(text)) !== null) {
                        // Add text before match
                        if (match.index > lastIndex) {
                            fragments.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                        }
                        
                        // Add highlighted match
                        const span = document.createElement('span');
                        span.className = `${matchesClassName} ${matchesStyleSelectorClassName}`;
                        span.textContent = match[0];
                        fragments.appendChild(span);
                        
                        lastIndex = regex.lastIndex;
                    }
                    
                    // Add remaining text
                    if (lastIndex < text.length) {
                        fragments.appendChild(document.createTextNode(text.slice(lastIndex)));
                    }
                    
                    node.parentNode.replaceChild(fragments, node);
                }
            } else if (node.nodeType === 1) { // Element node
                Array.from(node.childNodes).forEach(searchNodes);
            }
        }

        searchNodes(searchableContent);
        setTotalMatches();
        handleBackAndForthButtonsDisabledState();
        activeMatchIndex = -1;
        
        // Scroll to first match
        const firstHighlight = document.querySelector('.' + matchesClassName);
        if (firstHighlight) {
            scrollToElementCenter(firstHighlight);
        }
    }

    function debouncedSearchAndHighlight(query, shouldScrollToFirstMatch = false) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            highlightMatches(query);
        }, debounceTime);
    }

    function navigateMatches(direction) {
        const allMatches = document.querySelectorAll('.' + matchesClassName);
        if (allMatches.length === 0) return;

        if (direction === 'next') {
            activeMatchIndex = (activeMatchIndex + 1) % allMatches.length;
        } else {
            activeMatchIndex = activeMatchIndex <= 0 ? allMatches.length - 1 : activeMatchIndex - 1;
        }

        // Remove previous active styling
        allMatches.forEach(match => match.classList.remove('active'));
        
        // Add active styling and scroll to current match
        allMatches[activeMatchIndex].classList.add('active');
        scrollToElementCenter(allMatches[activeMatchIndex]);
    }

    /* Event listeners */
    searchInput.addEventListener("input", function () {
        debouncedSearchAndHighlight(searchInput.value, true);
    });

    goToNextMatchButton.addEventListener('click', () => navigateMatches('next'));
    goToPreviousMatchButton.addEventListener('click', () => navigateMatches('prev'));

    // Global keyboard navigation (Arrow keys work anywhere on the page)
    document.addEventListener('keyup', (event) => {
        if (totalMatches > 0) {
            switch (event.key) {
                case "ArrowRight":
                    goToNextMatchButton.click(); // Simulate a click on button
                    break;
                case "ArrowLeft":
                    goToPreviousMatchButton.click(); // Simulate a click on button
                    break;
            }
        }
    });

    // Keyboard navigation when search input is focused
    document.addEventListener('keydown', function(event) {
        if (document.activeElement === searchInput) {
            if (event.key === 'ArrowDown' && totalMatches > 0) {
                event.preventDefault();
                navigateMatches('next');
            } else if (event.key === 'ArrowUp' && totalMatches > 0) {
                event.preventDefault();
                navigateMatches('prev');
            }
        }
    });

    // Re-run search when definitions are collapsed/expanded
    document.addEventListener('click', event => {
        if (event.target.classList.contains('collapse-all-defs-button')) {
            debouncedSearchAndHighlight(searchInput.value, true);
        }
    });
}
