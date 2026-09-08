/**
 * RFCXML-safe anchors and display labels for Spec-Up-T terms.
 * IETF XML IDs must be XML Names (US-ASCII letter start; letters, digits, _, -, .).
 * Spec-Up-T HTML uses `term:slug`; RFCXML uses `term-slug` so the colon is not required.
 */

const { utils } = require('../../utils/regex-patterns');

function slugifyTerm(term) {
    const normalized = String(term ?? '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
    return utils.sanitizeTermId(normalized)
        .replaceAll(':', '-')
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function termToAnchor(term) {
    const slug = slugifyTerm(term);
    const body = slug || 'term';
    const prefixed = body.startsWith('term-') ? body : `term-${body}`;
    if (!/^[A-Za-z]/.test(prefixed)) {
        return `term-${prefixed}`;
    }
    return prefixed;
}

function displayTermLabel(term, aliases = []) {
    const extras = (aliases || []).map(alias => String(alias).trim()).filter(Boolean);
    if (extras.length === 0) {
        return String(term).trim();
    }
    const primary = extras[0];
    const rest = extras.slice(1);
    const parenthetical = [...rest, String(term).trim()].filter(Boolean);
    if (parenthetical.length === 0) {
        return primary;
    }
    return `${primary} (${parenthetical.join(', ')})`;
}

function isXmlName(anchor) {
    return /^[A-Za-z][A-Za-z0-9._-]*$/.test(String(anchor ?? ''));
}

function headingToAnchor(text) {
    const slug = slugifyTerm(text);
    const candidate = slug || 'section';
    if (!/^[A-Za-z]/.test(candidate)) {
        return `s-${candidate}`;
    }
    return candidate;
}

function uniquifyAnchor(anchor, used) {
    const usedSet = used || new Set();
    let candidate = String(anchor || 'section');
    if (!isXmlName(candidate)) {
        candidate = headingToAnchor(candidate);
    }
    let unique = candidate;
    let n = 2;
    while (usedSet.has(unique)) {
        unique = `${candidate}-${n}`;
        n++;
    }
    usedSet.add(unique);
    return unique;
}

module.exports = {
    slugifyTerm,
    termToAnchor,
    displayTermLabel,
    isXmlName,
    headingToAnchor,
    uniquifyAnchor
};
