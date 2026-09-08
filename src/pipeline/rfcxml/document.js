/**
 * Assemble a complete RFCXML v3 Internet-Draft from Spec-Up-T markdown.
 */

const { el, escapeXml } = require('./xml-builder');
const { normalizeIetfConfig } = require('./ietf-config');
const { collectTermsFromMarkdown, buildTermAnchorMap, renderTerminologyDl } = require('./terminology');
const { collectCitations, renderBibliography, sanitizeBibliographyAnchor } = require('./bibliography');
const { collectFlow, nestSections, renderSectionTree } = require('./body-walker');
const { createRfcxmlParser } = require('./create-rfcxml-parser');

const SECURITY_STUB = 'This document specifies terminology and has no direct effect on the security of implementations or deployments.';
const IANA_STUB = 'This document has no IANA actions.';

function renderAuthor(author) {
    const attrs = { fullname: author.fullname };
    if (author.initials) attrs.initials = author.initials;
    if (author.surname) attrs.surname = author.surname;
    if (author.role) attrs.role = author.role;

    const addressParts = [];
    if (author.postal) {
        const postalKids = [];
        for (const key of ['street', 'city', 'region', 'code', 'country']) {
            if (author.postal[key]) {
                postalKids.push(el(key, escapeXml(String(author.postal[key]))));
            }
        }
        if (postalKids.length) {
            addressParts.push(el('postal', postalKids));
        }
    }
    if (author.email) {
        addressParts.push(el('email', escapeXml(author.email)));
    }

    const kids = [];
    if (author.organization) {
        kids.push(el('organization', escapeXml(author.organization)));
    }
    if (addressParts.length) {
        kids.push(el('address', addressParts));
    }
    return el('author', attrs, kids.length ? kids : undefined);
}

function renderFront(ietf, abstractXml) {
    const parts = [];
    const titleAttrs = {};
    if (ietf.abbrev) {
        titleAttrs.abbrev = ietf.abbrev;
    }
    parts.push(el('title', titleAttrs, escapeXml(ietf.title)));
    parts.push(el('seriesInfo', { name: 'Internet-Draft', value: ietf.docName }));
    for (const author of ietf.authors) {
        parts.push(renderAuthor(author));
    }
    const dateAttrs = { year: String(ietf.date.year) };
    if (ietf.date.month) dateAttrs.month = String(ietf.date.month);
    if (ietf.date.day) dateAttrs.day = String(ietf.date.day);
    parts.push(el('date', dateAttrs));
    if (ietf.area) {
        parts.push(el('area', escapeXml(ietf.area)));
    }
    if (ietf.workgroup) {
        parts.push(el('workgroup', escapeXml(ietf.workgroup)));
    }
    for (const keyword of ietf.keyword) {
        parts.push(el('keyword', escapeXml(keyword)));
    }
    const abstractInner = ietf.abstract
        ? [el('t', escapeXml(ietf.abstract))]
        : (abstractXml && abstractXml.length
            ? abstractXml
            : [el('t', 'No abstract provided.')]);
    parts.push(el('abstract', abstractInner));
    return el('front', parts);
}

function buildExternalSpecAnchors(spec) {
    const map = new Map();
    for (const entry of spec.external_specs || []) {
        if (entry && entry.external_spec) {
            map.set(entry.external_spec, sanitizeBibliographyAnchor(entry.external_spec));
        }
    }
    return map;
}

function collectExternalSpecReferences(spec, citations) {
    for (const entry of spec.external_specs || []) {
        if (!entry || !entry.external_spec) continue;
        const anchor = sanitizeBibliographyAnchor(entry.external_spec);
        if (citations.has(anchor)) continue;
        citations.set(anchor, {
            kind: 'other',
            group: 'informative',
            anchor,
            title: entry.title || entry.external_spec,
            target: entry.gh_page || entry.url,
            authors: [{ organization: spec.author || ' ' }]
        });
    }
}

function ensureRequiredSections(middleXmlParts, flags, terminologyDl) {
    const parts = [...middleXmlParts];
    if (!flags.terminology && terminologyDl) {
        parts.push(el('section', { anchor: 'terminology' }, [
            el('name', 'Terminology'),
            terminologyDl
        ]));
    }
    if (!flags.security) {
        parts.push(el('section', { anchor: 'security' }, [
            el('name', 'Security Considerations'),
            el('t', escapeXml(SECURITY_STUB))
        ]));
    }
    if (!flags.iana) {
        parts.push(el('section', { anchor: 'iana' }, [
            el('name', 'IANA Considerations'),
            el('t', escapeXml(IANA_STUB))
        ]));
    }
    return parts;
}

function createExportContext(spec, ietf, terms, citations) {
    const warnings = [];
    return {
        warnings,
        terms,
        termAnchors: buildTermAnchorMap(terms),
        citations,
        externalSpecAnchors: buildExternalSpecAnchors(spec),
        ietf
    };
}

function buildRfcXml(spec, markdown, options = {}) {
    const ietf = normalizeIetfConfig(spec, options.now);
    const md = options.md || createRfcxmlParser();
    const tokens = md.parse(markdown || '', {});
    const citations = collectCitations(tokens, ietf);
    collectExternalSpecReferences(spec, citations);

    const terms = collectTermsFromMarkdown(markdown, { xtrefs: options.xtrefs });
    const ctx = createExportContext(spec, ietf, terms, citations);
    const terminologyDl = terms.length ? renderTerminologyDl(terms, md, ctx) : '';
    ctx.terminologyDl = terminologyDl;

    const flow = collectFlow(tokens, ctx);
    const nested = nestSections(flow, { title: ietf.title });
    const middleRendered = renderSectionTree(nested.middle, ctx);
    const middle = ensureRequiredSections(middleRendered, nested.flags, terminologyDl);
    const backRendered = renderSectionTree(nested.back, ctx);
    const bibliography = renderBibliography(citations);
    const backParts = [...backRendered];
    if (bibliography) {
        backParts.unshift(bibliography);
    }

    const abstractXml = nested.abstractParts.length ? nested.abstractParts : null;
    const rfcInner = [
        renderFront(ietf, abstractXml),
        el('middle', middle)
    ];
    if (backParts.length) {
        rfcInner.push(el('back', backParts));
    }

    const rfcOpenAttrs = [
        'xmlns:xi="http://www.w3.org/2001/XInclude"',
        `ipr="${escapeXml(ietf.ipr)}"`,
        `docName="${escapeXml(ietf.docName)}"`,
        `category="${escapeXml(ietf.category)}"`,
        `submissionType="${escapeXml(ietf.submissionType)}"`,
        `consensus="${ietf.consensus ? 'true' : 'false'}"`,
        `tocInclude="${ietf.tocInclude ? 'true' : 'false'}"`,
        `sortRefs="${ietf.sortRefs ? 'true' : 'false'}"`,
        `symRefs="${ietf.symRefs ? 'true' : 'false'}"`,
        'version="3"'
    ];
    if (ietf.obsoletes) rfcOpenAttrs.push(`obsoletes="${escapeXml(ietf.obsoletes)}"`);
    if (ietf.updates) rfcOpenAttrs.push(`updates="${escapeXml(ietf.updates)}"`);

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<rfc ${rfcOpenAttrs.join(' ')}>`,
        rfcInner.join('\n'),
        '</rfc>',
        ''
    ].join('\n');

    return { xml, warnings: ctx.warnings, ietf, terms, citations };
}

module.exports = {
    SECURITY_STUB,
    IANA_STUB,
    renderAuthor,
    renderFront,
    ensureRequiredSections,
    buildRfcXml
};
