# Terminology Section Utility Container

This directory contains the modular components for the terminology section utility container functionality.

## Architecture

The architecture follows a clear separation of concerns:

- **DOM Construction**: All layout and structure in `../terminology-section-utility-container.js`
- **Functionality**: Individual behavior modules in this directory

## Structure

```text
terminology-section-utility-container/
├── README.md                                      # This documentation
├── hide-show-utility-container.js                # Removes container when no terms
├── create-alphabet-index.js                      # Alphabet navigation functionality  
├── create-term-filter.js                         # Local/Remote filter functionality
└── search.js                                     # Search functionality
```

## Main Module (`../terminology-section-utility-container.js`)

The main coordination module contains:

### DOM Construction Section
Complete layout definition in one place:

```text
/* ===== ROW 1: ALPHABET INDEX ===== */
- Bootstrap row/col structure
- Alphabet navigation buttons
- Sorted character links

/* ===== ROW 2: UTILITIES ===== */  
- Term count display
- Local/Remote filter checkboxes
- Search input with navigation buttons
- Matches counter
```

### Functionality Coordination
Calls the individual modules:

1. `attachAlphabetIndexFunctionality()`
2. `attachTermFilterFunctionality(checkboxesContainer)`
3. `attachSearchFunctionality(searchInput, prevBtn, nextBtn, counter)`

## Sub-Modules (Functionality Only)

Each module receives DOM elements as parameters and attaches behavior:

### `create-alphabet-index.js`
- Currently minimal (standard anchor links)
- Ready for future enhancements (smooth scroll, analytics)

### `create-term-filter.js`
- Checkbox change event handling
- "At least one checked" enforcement logic
- HTML class toggling for hide/show terms

### `search.js`
- Input event handling with debouncing
- Text highlighting and regex matching
- Keyboard navigation (Arrow keys)
- Match counting and navigation

## Dependencies

All modules depend on:

- Bootstrap 5.3+ (for styling classes)
- `specConfig` global object (for search styling configuration)

## Usage

The modules are automatically loaded and initialized via the asset compilation process. The main module coordinates everything when the DOM is ready.

## Layout Result

**Row 1 (Alphabet):**

```text
[A] [B] [C] [D] [E] [F] [G] [H] [I] [J] [K] [L] [M] [N] [O] [P] [Q] [R] [S] [T] [U] [V] [W] [X] [Y] [Z]
```

**Row 2 (Controls):**

```text
25 terms    ☑ Local  ☑ Remote    [🔍 Search] [0 matches] [▲] [▼]
```

## Benefits of This Architecture

✅ **Layout Visibility**: Complete DOM structure visible in one file  
✅ **Modular Logic**: Functionality separated by concern  
✅ **Maintainability**: Easy to modify layout or individual behaviors  
✅ **Testability**: Functions receive dependencies as parameters  
✅ **Reusability**: Logic modules could be used elsewhere  

## Maintenance Notes

- Order in `asset-map.json` matters: functionality modules before main module
- All modules use traditional function declarations for Gulp compatibility
- DOM elements are passed as parameters to avoid tight coupling
- Bootstrap classes are used extensively to minimize custom CSS
