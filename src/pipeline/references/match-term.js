/**
 * @file match-term.js
 * @description Utilities for matching a specific term within a [[def: ...]] definition block.
 */

const { isLineWithDefinition } = require('../../utils/is-line-with-definition');
const Logger = require('../../utils/logger');

function matchTerm(text, term) {
    if (!text || typeof text !== 'string') {
        Logger.warn('Nothing to match for term:', term);
        return false;
    }

    const firstLine = text.split('\n')[0].trim();
    if (!isLineWithDefinition(firstLine)) {
        Logger.warn('String does not start with `[[def:` or end with `]]`');
        return false;
    }

    const startPos = firstLine.indexOf('[[def:') + 6;
    const endPos = firstLine.indexOf(']]');
    if (startPos === -1 || endPos === -1) {
        return false;
    }

    const relevantPart = firstLine.substring(startPos, endPos);
    const termsArray = relevantPart.split(',').map(entry => entry.trim());
    return termsArray.includes(term);
}

module.exports = {
    matchTerm
};
