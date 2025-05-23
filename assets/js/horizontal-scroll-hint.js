/**
 * @file Adds a visual horizontal scroll hint to elements with overflow content
 * @author Kor Dwarshuis
 * @version 1.1.0
 * @license MIT
 * @see https://example.com/more_info_about_horizontal_scroll for more information
 * @since 2022-01-01
 * 
 * @description
 * The horizontalScrollHint function improves user experience in specification documents
 * by providing a visual cue when content extends beyond the visible horizontal area.
 * It dynamically adds a hint element with a finger-pointing icon and text to elements
 * that require horizontal scrolling, particularly useful for wide tables, code blocks,
 * and other overflowing content in technical specifications.
 * 
 * Features:
 * - Automatically detects when content is wider than its container
 * - Shows a visual hint with a finger pointing icon and text
 * - Hint disappears after the user scrolls horizontally
 * - Adaptive to window resizing (shows/hides based on current overflow state)
 * - Can be applied to single elements, multiple elements, or CSS selectors
 * - Uses ResizeObserver to monitor for dynamic content changes
 * 
 * @param {(string|Element|Array<string|Element>)} [elements='.horizontalScroll'] - Target element(s) to apply the scroll hint to:
 *   - String: CSS selector for target elements
 *   - Element: Direct DOM element reference
 *   - Array: Multiple CSS selectors or DOM elements
 *   - If omitted, defaults to '.horizontalScroll'
 * 
 * @returns {void} This function doesn't return a value
 * 
 * @example
 * // Basic usage with default selector ('.horizontalScroll')
 * horizontalScrollHint();
 * 
 * @example
 * // Apply to a specific element by selector
 * horizontalScrollHint('#specification-table');
 * 
 * @example
 * // Apply to multiple different elements
 * horizontalScrollHint(['.table-responsive', '.code-block', document.querySelector('#algorithm-section')]);
 * 
 * @example
 * // In your main script, typically call on DOMContentLoaded
 * document.addEventListener("DOMContentLoaded", function() {
 *   horizontalScrollHint('.table-responsive');
 * });
 */

const horizontalScrollHint = (elements) => {
  // Credits: <a href="https://www.flaticon.com/free-icons/hand-cursor" title="hand cursor icons">Hand cursor icons created by Icon Bolt - Flaticon</a>
  const fingerHorizontalScrollingImage =
    'data:image/png;base64,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';
 
  // Create styles for the horizontal scroll hint
  if (!document.getElementById('horizontalScrollHintStyles')) {
    const style = document.createElement('style');
    style.id = 'horizontalScrollHintStyles';
    style.textContent = `
      @keyframes arrow-tweet-panel-pulse {
        0%,
        to {
            transform: translateZ(0);
        }
        50% {
            transform: translate3d(10px, 0, 0);
        }
      }

      .scrollHint {
        position: absolute;
        top: 1em;
        right: 1em;
        background: #EEE;
        padding: 0.5em;

        /* https://smoothshadows.com/#djEsMSw1LDAuMDgsMjQsMCwwLCMwMzA3MTIsI2YzZjRmNiwjZmZmZmZmLDI%3D */
        box-shadow: 0px 0px 1px rgba(3, 7, 18, 0.02),
        0px 0px 4px rgba(3, 7, 18, 0.03),
        0px 0px 9px rgba(3, 7, 18, 0.05),
        0px 0px 15px rgba(3, 7, 18, 0.06),
        0px 0px 24px rgba(3, 7, 18, 0.08);

        border-radius: 7px;
        opacity: 0;
        transition: opacity 1s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  // If no elements provided or null/undefined, use default selector
  if (!elements) {
    elements = '.horizontalScroll';
  }

  // Convert single element or selector to array
  const elementSelectors = Array.isArray(elements) ? elements : [elements];
  
  // Process each element selector
  elementSelectors.forEach(selector => {
    // Handle both direct DOM elements and selector strings
    const targets = typeof selector === 'string' 
      ? document.querySelectorAll(selector)
      : [selector];
    
    // Apply to each matched element
    Array.from(targets).forEach(el => {
      if (el) {
        el.style.position = 'relative';
        
        // Create scroll hint element
        const scrollHint = document.createElement('p');
        scrollHint.classList.add('scrollHint');
        scrollHint.innerHTML = `<img class='scrollHintImage' style='width: 40px; vertical-align: middle; padding: 0;margin: 0 !important;' src='${fingerHorizontalScrollingImage}' alt='' /> Scroll to the right`;
        scrollHint.style.animation = 'arrow-tweet-panel-pulse 0.82s ease-in-out infinite';

        el.appendChild(scrollHint);

        // Function to show/hide hint based on scroll width
        function showHideScrollHint() {
          if (el.scrollWidth > el.clientWidth) {
            scrollHint.style.opacity = '1';
          } else {
            scrollHint.style.opacity = '0';
          }
        }

        // Hide hint when user scrolls
        function hideScrollHint() {
          scrollHint.style.opacity = '0';
        }

        // Initialize visibility
        showHideScrollHint();

        // Watch for element size changes
        new ResizeObserver(showHideScrollHint).observe(el);

        // Handle scroll events
        el.addEventListener('scroll', hideScrollHint);
      }
    });
  });
};

document.addEventListener("DOMContentLoaded", function () {
  // Apply to a default class
  // horizontalScrollHint();

  // Apply to a specific selector
  // horizontalScrollHint('#myElement');

  // Apply to multiple different elements
  // horizontalScrollHint(['.table-container', '.code-block', document.querySelector('#special-element')]);

  horizontalScrollHint(['.table-responsive-md']);
});