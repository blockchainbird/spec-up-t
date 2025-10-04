/**
 * @file Utility helpers for identifying, parsing, and aggregating external term references (xref/tref).
 *
 * These functions were previously embedded in the monolithic `collect-external-references` module.
 * Splitting them into a dedicated utility keeps the collection pipeline focused on orchestration
 * and makes the primitives easier to reuse in other reference-aware stages.
 */

const { externalReferences, utils } = require('../../utils/regex-patterns');

/**
 * Checks if a specific xtref is present in the markdown content.
 *
 * @param {{ externalSpec: string, term: string }} xtref - Reference descriptor.
 * @param {string} markdownContent - Markdown text to inspect.
 * @returns {boolean} True when the reference is found.
 */
function isXTrefInMarkdown(xtref, markdownContent) {
    const regexTerm = utils.createXTrefRegex(xtref.externalSpec, xtref.term);
    return regexTerm.test(markdownContent);
}

/**
 * Finds a reference across multiple markdown files.
 *
 * @param {{ externalSpec: string, term: string }} xtref - Reference descriptor.
 * @param {Map<string, string>} fileContents - Markdown contents keyed by filename.
 * @returns {boolean} True when the reference is found in any file.
 */
function isXTrefInAnyFile(xtref, fileContents) {
    for (const content of fileContents.values()) {
        if (isXTrefInMarkdown(xtref, content)) {
            return true;
        }
    }
    return false;
}

/**
 * Adds a pre-parsed xtref object to the aggregated collection.
 * This function handles deduplication and source file tracking.
 *
 * @param {object} xtrefObject - Pre-parsed xtref object from template-tag-parser
 * @param {{ xtrefs: Array<object> }} allXTrefs - Aggregated reference collection
 * @param {string|null} filename - Originating filename for bookkeeping
 * @returns {{ xtrefs: Array<object> }} Updated reference collection
 */
function addXtrefToCollection(xtrefObject, allXTrefs, filename = null) {
    const referenceType = xtrefObject.referenceType;
    const cleanXTrefObj = { ...xtrefObject };
    delete cleanXTrefObj.referenceType;

    const existingIndex = allXTrefs?.xtrefs?.findIndex(existingXTref =>
        existingXTref.term === cleanXTrefObj.term &&
        existingXTref.externalSpec === cleanXTrefObj.externalSpec
    );

    if (existingIndex === -1) {
        if (filename) {
            cleanXTrefObj.sourceFiles = [{ file: filename, type: referenceType }];
        }
        allXTrefs.xtrefs.push(cleanXTrefObj);
        return allXTrefs;
    }

    if (!filename) {
        return allXTrefs;
    }

    const existingXTref = allXTrefs.xtrefs[existingIndex];

    // Update the existing entry with new data to handle changes in aliases
    // Preserve the existing sourceFiles array and extend it with new entries
    const existingSourceFiles = existingXTref.sourceFiles || [];

    // Smart merge: Priority is given to tref over xref for properties like aliases
    // If the new reference is an xref and existing has tref data, preserve tref properties
    const hasExistingTref = existingSourceFiles.some(sf => sf.type === 'tref');
    const isNewXref = referenceType === 'xref';

    if (hasExistingTref && isNewXref) {
        // Don't overwrite tref data with xref data - just merge xref aliases
        // Keep existing tref aliases and properties, but add xref aliases
        if (cleanXTrefObj.xrefAliases && cleanXTrefObj.xrefAliases.length > 0) {
            existingXTref.xrefAliases = cleanXTrefObj.xrefAliases;
            existingXTref.firstXrefAlias = cleanXTrefObj.firstXrefAlias;
        }
    } else if (!hasExistingTref && isNewXref) {
        // New xref with no existing tref - initialize empty tref arrays
        Object.assign(existingXTref, cleanXTrefObj);
        if (!existingXTref.trefAliases) {
            existingXTref.trefAliases = [];
        }
    } else {
        // Update with new tref data (either new tref, or updating existing tref)
        Object.assign(existingXTref, cleanXTrefObj);
        
        // Ensure xref arrays exist if not present in new object
        if (!cleanXTrefObj.xrefAliases && !existingXTref.xrefAliases) {
            existingXTref.xrefAliases = [];
        }

        // Handle properties that should be removed when not present in the new object
        if (!cleanXTrefObj.hasOwnProperty('firstTrefAlias') && existingXTref.hasOwnProperty('firstTrefAlias')) {
            delete existingXTref.firstTrefAlias;
        }
        if (!cleanXTrefObj.hasOwnProperty('firstXrefAlias') && existingXTref.hasOwnProperty('firstXrefAlias')) {
            delete existingXTref.firstXrefAlias;  
        }
    }

    // Restore and update the sourceFiles array
    existingXTref.sourceFiles = existingSourceFiles;

    if (filename) {
        const newEntry = { file: filename, type: referenceType };
        const alreadyTracked = existingXTref.sourceFiles.some(entry =>
            entry.file === filename && entry.type === referenceType
        );

        if (!alreadyTracked) {
            existingXTref.sourceFiles.push(newEntry);
        }
    }

    return allXTrefs;
}

/**
 * Adds new references discovered in markdown to an aggregated collection.
 * This function uses external parsing to maintain separation of concerns
 * between parsing and collection logic.
 *
 * @param {string} markdownContent - Markdown text to scan.
 * @param {{ xtrefs: Array<object> }} allXTrefs - Aggregated reference collection.
 * @param {string|null} filename - Originating filename for bookkeeping.
 * @param {function} processXTrefObject - Parsing function for xtref strings.
 * @returns {{ xtrefs: Array<object> }} Updated reference collection.
 */
function addNewXTrefsFromMarkdown(markdownContent, allXTrefs, filename = null, processXTrefObject) {
    if (!processXTrefObject) {
        throw new Error('processXTrefObject function is required. Import from template-tag-parser.');
    }

    const regex = externalReferences.allXTrefs;

    if (!regex.test(markdownContent)) {
        return allXTrefs;
    }

    const xtrefs = markdownContent.match(regex) || [];

    xtrefs.forEach(rawXtref => {
        const xtrefObject = processXTrefObject(rawXtref);
        addXtrefToCollection(xtrefObject, allXTrefs, filename);
    });

    return allXTrefs;
}

module.exports = {
    isXTrefInMarkdown,
    isXTrefInAnyFile,
    addXtrefToCollection,
    addNewXTrefsFromMarkdown
};
