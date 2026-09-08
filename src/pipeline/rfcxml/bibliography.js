/**
 * Map Spec-Up-T [[spec:]] citations and ietf.references to RFCXML bibliography entries.
 * RFCs/BCPs/STDs/I-Ds use bib.ietf.org xi:include; other works become explicit <reference> elements.
 */

const { el, escapeXml } = require('./xml-builder');
const { headingToAnchor } = require('./term-anchor');

const RFC_RE = /^(?:RFC[-\s]?)(\d+)$/i;
const BCP_RE = /^(?:BCP[-\s]?)(\d+)$/i;
const STD_RE = /^(?:STD[-\s]?)(\d+)$/i;
const DRAFT_RE = /^(?:I-D\.)?(?:draft-)?(.+)$/i;

function sanitizeBibliographyAnchor(name) {
    let slug = String(name ?? '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) {
        slug = 'ref';
    }
    if (!/^[A-Za-z]/.test(slug)) {
        slug = `ref-${slug}`;
    }
    return slug;
}

function classifyCitation(name) {
    const trimmed = String(name ?? '').trim();
    const rfc = trimmed.match(RFC_RE);
    if (rfc) {
        const number = String(Number(rfc[1]));
        return {
            kind: 'rfc',
            number,
            anchor: `RFC${number}`,
            href: `https://bib.ietf.org/public/rfc/bibxml/reference.RFC.${number}.xml`
        };
    }
    const bcp = trimmed.match(BCP_RE);
    if (bcp) {
        const number = String(Number(bcp[1]));
        return {
            kind: 'bcp',
            number,
            anchor: `BCP${number}`,
            href: `https://bib.ietf.org/public/rfc/bibxml/reference.BCP.${number}.xml`
        };
    }
    const std = trimmed.match(STD_RE);
    if (std) {
        const number = String(Number(std[1]));
        return {
            kind: 'std',
            number,
            anchor: `STD${number}`,
            href: `https://bib.ietf.org/public/rfc/bibxml/reference.STD.${number}.xml`
        };
    }
    if (/^(I-D\.|draft-)/i.test(trimmed)) {
        const match = trimmed.match(DRAFT_RE);
        const draftName = match ? match[1].replace(/^draft-/i, '') : trimmed;
        return {
            kind: 'draft',
            name: draftName,
            anchor: `I-D.${draftName}`,
            href: `https://bib.ietf.org/public/rfc/bibxml3/reference.I-D.${draftName}.xml`
        };
    }
    return {
        kind: 'other',
        name: trimmed,
        anchor: sanitizeBibliographyAnchor(trimmed),
        title: trimmed
    };
}

function isNormativeSpecType(type) {
    return /^spec-normative$/i.test(type) || /^spec-required$/i.test(type);
}

function collectFromTokens(tokens, citations) {
    if (!Array.isArray(tokens)) {
        return;
    }
    for (const token of tokens) {
        if (token.type === 'template' && token.info) {
            const type = token.info.type || '';
            if (/^spec/i.test(type)) {
                const name = (token.info.args && token.info.args[0]) || '';
                if (name) {
                    const classified = classifyCitation(name);
                    const existing = citations.get(classified.anchor);
                    const group = isNormativeSpecType(type) ? 'normative' : 'informative';
                    if (!existing) {
                        citations.set(classified.anchor, { ...classified, group });
                    } else if (group === 'normative') {
                        existing.group = 'normative';
                    }
                }
            }
        }
        if (token.children) {
            collectFromTokens(token.children, citations);
        }
    }
}

function normalizeConfiguredReference(entry, defaultGroup) {
    if (typeof entry === 'string') {
        return { ...classifyCitation(entry), group: defaultGroup };
    }
    const classified = entry.anchor
        ? { kind: 'other', anchor: sanitizeBibliographyAnchor(entry.anchor), ...entry }
        : { ...classifyCitation(entry.title || entry.name || 'ref'), ...entry };
    return {
        kind: classified.kind || 'other',
        anchor: classified.anchor || sanitizeBibliographyAnchor(entry.anchor || entry.title || 'ref'),
        href: classified.href || entry.href,
        title: entry.title || classified.title || classified.anchor,
        target: entry.target,
        date: entry.date,
        authors: entry.authors || [],
        group: defaultGroup
    };
}

function collectCitations(tokens, ietfConfig = {}) {
    const citations = new Map();
    collectFromTokens(tokens, citations);

    const configured = ietfConfig.references || {};
    for (const entry of configured.normative || []) {
        const ref = normalizeConfiguredReference(entry, 'normative');
        citations.set(ref.anchor, { ...citations.get(ref.anchor), ...ref, group: 'normative' });
    }
    for (const entry of configured.informative || []) {
        const ref = normalizeConfiguredReference(entry, 'informative');
        if (!citations.has(ref.anchor) || citations.get(ref.anchor).group !== 'normative') {
            citations.set(ref.anchor, { ...citations.get(ref.anchor), ...ref, group: 'informative' });
        }
    }

    return citations;
}

function renderExplicitReference(ref) {
    const authors = (ref.authors || []).map(author => {
        if (typeof author === 'string') {
            return el('author', { fullname: author }, el('organization', author));
        }
        const attrs = {};
        if (author.fullname) attrs.fullname = author.fullname;
        if (author.initials) attrs.initials = author.initials;
        if (author.surname) attrs.surname = author.surname;
        const org = author.organization
            ? el('organization', escapeXml(author.organization))
            : el('organization', ' ');
        return el('author', attrs, org);
    });
    if (authors.length === 0) {
        authors.push(el('author', el('organization', ' ')));
    }
    const frontParts = [
        el('title', escapeXml(ref.title || ref.anchor)),
        ...authors
    ];
    if (ref.date) {
        const dateAttrs = typeof ref.date === 'object' ? ref.date : { year: ref.date };
        frontParts.push(el('date', dateAttrs));
    }
    const attrs = { anchor: ref.anchor };
    if (ref.target) {
        attrs.target = ref.target;
    }
    return el('reference', attrs, el('front', frontParts));
}

function renderXiInclude(ref) {
    return `<xi:include href="${escapeXml(ref.href)}" parse="xml"/>`;
}

function renderReferenceItem(ref) {
    if (ref.href && ref.kind !== 'other') {
        return renderXiInclude(ref);
    }
    return renderExplicitReference(ref);
}

function renderReferencesSection(name, refs) {
    if (!refs.length) {
        return null;
    }
    const sorted = [...refs].sort((a, b) => a.anchor.localeCompare(b.anchor));
    return el(
        'references',
        { anchor: headingToAnchor(name) },
        [el('name', escapeXml(name)), ...sorted.map(renderReferenceItem)]
    );
}

function renderBibliography(citations) {
    const all = [...citations.values()];
    const normative = all.filter(ref => ref.group === 'normative');
    const informative = all.filter(ref => ref.group !== 'normative');

    if (normative.length === 0 && informative.length === 0) {
        return '';
    }

    const sections = [];
    const normativeXml = renderReferencesSection('Normative References', normative);
    const informativeXml = renderReferencesSection('Informative References', informative);
    if (normativeXml) sections.push(normativeXml);
    if (informativeXml) sections.push(informativeXml);
    return sections.join('\n');
}

function lookupCitationAnchor(name, citations) {
    const classified = classifyCitation(name);
    if (citations && citations.has(classified.anchor)) {
        return classified.anchor;
    }
    return classified.anchor;
}

module.exports = {
    classifyCitation,
    sanitizeBibliographyAnchor,
    isNormativeSpecType,
    collectCitations,
    renderBibliography,
    renderExplicitReference,
    renderXiInclude,
    lookupCitationAnchor
};
