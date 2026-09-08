/**
 * Collect Spec-Up-T [[def:]] / [[tref:]] glossary entries and emit RFC 9940-style RFCXML <dl>.
 */

const { el, escapeXml } = require('./xml-builder');
const { termToAnchor, displayTermLabel, slugifyTerm } = require('./term-anchor');
const { renderParagraphsFromMarkdown } = require('./inline');

const DEF_LINE_RE = /^\[\[(def|tref):\s*([^\]]+)\]\]\s*$/i;

function parseArgs(raw) {
    return String(raw)
        .split(/\s*,\s*/)
        .map(part => part.trim())
        .filter(Boolean);
}

function lookupTrefDefinition(xtrefs, externalSpec, term) {
    if (!xtrefs) {
        return '';
    }
    const list = Array.isArray(xtrefs) ? xtrefs : xtrefs.xtrefs;
    if (!Array.isArray(list)) {
        return '';
    }
    const key = slugifyTerm(term);
    const found = list.find(entry =>
        entry.externalSpec === externalSpec &&
        slugifyTerm(entry.term) === key
    );
    if (!found || !found.content) {
        return '';
    }
    return String(found.content)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function collectTermsFromMarkdown(markdown, options = {}) {
    const lines = String(markdown || '').split('\n');
    const terms = [];

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(DEF_LINE_RE);
        if (!match) {
            continue;
        }
        const type = match[1].toLowerCase();
        const args = parseArgs(match[2]);
        let term;
        let aliases;
        let externalSpec;
        if (type === 'tref') {
            externalSpec = args[0];
            term = args[1];
            aliases = args.slice(2);
        } else {
            term = args[0];
            aliases = args.slice(1);
        }
        if (!term) {
            continue;
        }

        const defLines = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
            j++;
        }
        while (j < lines.length) {
            const line = lines[j];
            if (DEF_LINE_RE.test(line) || /^#{1,6}\s/.test(line)) {
                break;
            }
            if (line.startsWith('~ ')) {
                defLines.push(line.slice(2));
            } else if (line.trim() === '') {
                if (defLines.length) {
                    defLines.push('');
                }
            } else {
                break;
            }
            j++;
        }

        let definitionMarkdown = defLines.join('\n').trim();
        if (!definitionMarkdown && type === 'tref') {
            definitionMarkdown = lookupTrefDefinition(options.xtrefs, externalSpec, term);
        }

        const aliasesLower = aliases.map(alias => alias.toLowerCase());
        terms.push({
            type,
            term,
            aliases,
            externalSpec,
            definitionMarkdown,
            anchor: termToAnchor(term),
            aliasAnchors: aliases.map(alias => termToAnchor(alias)),
            keys: [term.toLowerCase(), ...aliasesLower]
        });
    }

    return terms;
}

function buildTermAnchorMap(terms) {
    const map = new Map();
    for (const term of terms) {
        for (const key of term.keys) {
            map.set(key, term.anchor);
        }
    }
    return map;
}

function sortTerms(terms) {
    return [...terms].sort((a, b) =>
        displayTermLabel(a.term, a.aliases).localeCompare(displayTermLabel(b.term, b.aliases), undefined, { sensitivity: 'base' })
    );
}

function renderTerminologyDl(terms, md, ctx) {
    if (!terms.length) {
        return '';
    }
    const items = sortTerms(terms).map(term => {
        const label = displayTermLabel(term.term, term.aliases);
        const dt = el('dt', { anchor: term.anchor }, escapeXml(label));
        const paragraphs = renderParagraphsFromMarkdown(md, term.definitionMarkdown, ctx);
        let ddInner = paragraphs.length ? paragraphs.join('\n') : '<t>No definition provided.</t>';
        if (term.type === 'tref' && term.externalSpec && ctx.externalSpecAnchors?.has(term.externalSpec)) {
            const cite = `<t>Source: <xref target="${ctx.externalSpecAnchors.get(term.externalSpec)}"/>.</t>`;
            if (!term.definitionMarkdown) {
                ddInner = cite;
            } else {
                ddInner = `${ddInner}\n${cite}`;
            }
        }
        const dd = el('dd', ddInner);
        return `${dt}\n${dd}`;
    });
    return el('dl', { newline: 'true', spacing: 'normal' }, items);
}

function isTermDefinitionLine(line) {
    return DEF_LINE_RE.test(String(line || '').trim());
}

module.exports = {
    parseArgs,
    lookupTrefDefinition,
    collectTermsFromMarkdown,
    buildTermAnchorMap,
    renderTerminologyDl,
    isTermDefinitionLine
};
