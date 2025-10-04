/**
 * @fileoverview Utility functions for managing the definition buttons container.
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2025-10-02
 * @description This module provides centralized utilities for creating and managing
 * the container that holds control buttons in definition list terms (dt elements).
 * This approach eliminates code duplication and provides a single source of truth
 * for button container logic.
 */

/**
 * Gets or creates a button container within a definition term (dt) element.
 * If a container already exists, it returns that container to prevent duplicates.
 * If no container exists, it creates one and appends it to the dt element.
 * 
 * This function serves as the single point of control for button container creation,
 * ensuring consistency across all definition-related button functionality.
 * 
 * @function getOrCreateButtonContainer
 * @param {HTMLElement} dtElement - The dt (definition term) element that should contain the button container
 * @returns {HTMLElement} The button container div element (either existing or newly created)
 * 
 * @example
 * // Get or create a container for a definition term
 * const dt = document.querySelector('dt');
 * const container = getOrCreateButtonContainer(dt);
 * 
 * // Add buttons to the container
 * const myButton = document.createElement('button');
 * container.appendChild(myButton);
 */
function getOrCreateButtonContainer(dtElement) {
    // First, check if a container already exists to avoid duplicates
    let buttonContainer = dtElement.querySelector('.definition-buttons-container');
    
    // If no container exists, create one
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.classList.add('definition-buttons-container');
        dtElement.appendChild(buttonContainer);
    }
    
    return buttonContainer;
}

/**
 * Adds a button to a definition term's button container.
 * This is a convenience function that combines getting/creating the container
 * and adding a button to it in a single operation.
 * 
 * @function addButtonToContainer
 * @param {HTMLElement} dtElement - The dt (definition term) element
 * @param {HTMLElement} button - The button element to add to the container
 * @param {boolean} [prepend=false] - If true, adds the button at the beginning; if false, appends at the end
 * @returns {HTMLElement} The button container element
 * 
 * @example
 * // Add a button to the end of the container
 * const dt = document.querySelector('dt');
 * const myButton = document.createElement('button');
 * addButtonToContainer(dt, myButton);
 * 
 * @example
 * // Add a button to the beginning of the container
 * const dt = document.querySelector('dt');
 * const firstButton = document.createElement('button');
 * addButtonToContainer(dt, firstButton, true);
 */
function addButtonToContainer(dtElement, button, prepend = false) {
    const container = getOrCreateButtonContainer(dtElement);
    
    if (prepend) {
        // Add button as the first child
        container.insertBefore(button, container.firstChild);
    } else {
        // Add button as the last child
        container.appendChild(button);
    }
    
    return container;
}
