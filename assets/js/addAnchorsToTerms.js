function addAnchorsToTerms() {
    // Function to find the appropriate span for anchor linking
    // For external references (tref), we need to use the main term ID, not alias ID
    function findMainTermSpan(element) {
        // First, check if this is a transcluded external reference
        const transcludedSpan = element.querySelector('span.transcluded-xref-term[id^="term:"]');
        if (transcludedSpan) {
            // For transcluded external references, always use the main term ID (outermost span)
            // This ensures that anchor links work correctly with external content insertion
            return transcludedSpan;
        }
        
        // For regular terms, find the deepest span
        let currentElement = element;
        while (currentElement.querySelector('span[id^="term:"]')) {
            currentElement = currentElement.querySelector('span[id^="term:"]');
        }
        return currentElement;
    }


    const dts = document.querySelectorAll('dt:has(> span[id^="term:"])');

    dts.forEach(item => {

        const dt = findMainTermSpan(item);
        const id = dt.getAttribute('id');
        const a = document.createElement('a');
        a.setAttribute('href', `#${id}`);
        a.setAttribute('class', 'toc-anchor d-print-none');
        a.innerHTML = '# '; // was '§';
        dt.parentNode.insertBefore(a, dt);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    addAnchorsToTerms();
});
