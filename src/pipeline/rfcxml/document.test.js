const fs = require('node:fs');
const path = require('node:path');
const { buildRfcXml, SECURITY_STUB, IANA_STUB, renderAuthor, renderFront, ensureRequiredSections } = require('./document');

const tinySpec = {
    title: 'Some Key Terms',
    description: 'Fallback description',
    author: 'Example Org',
    external_specs: [{
        external_spec: 'ExtRef1',
        gh_page: 'https://example.com/extref1/',
        url: 'https://github.com/example/extref1',
        title: 'External Glossary 1'
    }],
    ietf: {
        docName: 'draft-example-terms-00',
        category: 'info',
        ipr: 'trust200902',
        abstract: 'This document sets out some terms.',
        abbrev: 'Terms',
        keyword: ['terminology'],
        workgroup: 'Example WG',
        area: 'ops',
        date: { year: 2026, month: 'August', day: 31 },
        authors: [{
            fullname: 'Nigel Davis',
            initials: 'N.',
            surname: 'Davis',
            organization: 'Example',
            email: 'nigel@example.com',
            role: 'editor'
        }],
        references: {
            informative: [{
                anchor: 'Adrian2015',
                title: 'Imperfect Forward Secrecy',
                target: 'https://example.com/adrian2015',
                date: '2015',
                authors: [{ fullname: 'D. Adrian' }]
            }]
        }
    }
};

const tinyMarkdown = [
    '# Some Key Terms',
    '',
    'This document defines [[ref: Event]] and cites [[spec: RFC2119]] and [[Adrian2015](#Adrian2015)].',
    'Implementations MUST comply. See also [[xref: ExtRef1, greenhouse]].',
    '',
    '## Abstract',
    '',
    'Ignored in favor of ietf.abstract when both exist; still parsed.',
    '',
    '## Status of This Memo',
    '',
    'xml2rfc generates this.',
    '',
    '## Terminology',
    '',
    'The following terms apply.',
    '',
    '[[def: Event, Events]]',
    '',
    '~ An Event is a noteworthy occurrence. See [[spec: RFC3877]].',
    '',
    '[[tref: ExtRef1, greenhouse, Greenhouse]]',
    '',
    '## Security Considerations',
    '',
    'There are no new security concerns.',
    '',
    '## IANA Considerations',
    '',
    'This document has no IANA actions.',
    '',
    '## Normative References',
    '',
    '[[spec-normative:]]'
].join('\n');

describe('rfcxml document (golden)', () => {
    test('emits a v3 rfc with front, terminology dl, xrefs, and bib.ietf.org includes', () => {
        const { xml, terms, warnings } = buildRfcXml(tinySpec, tinyMarkdown, {
            xtrefs: { xtrefs: [{ externalSpec: 'ExtRef1', term: 'greenhouse', content: 'A glass building.' }] },
            now: new Date(Date.UTC(2026, 7, 31))
        });

        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml).toContain('xmlns:xi="http://www.w3.org/2001/XInclude"');
        expect(xml).toContain('version="3"');
        expect(xml).toContain('docName="draft-example-terms-00"');
        expect(xml).toContain('ipr="trust200902"');
        expect(xml).toContain('<title abbrev="Terms">Some Key Terms</title>');
        expect(xml).toContain('<seriesInfo name="Internet-Draft" value="draft-example-terms-00"/>');
        expect(xml).toContain('fullname="Nigel Davis"');
        expect(xml).toContain('role="editor"');
        expect(xml).toContain('<abstract>');
        expect(xml).toContain('This document sets out some terms.');
        expect(xml).toContain('<dt anchor="term-event">');
        expect(xml).toContain('Events (Event)');
        expect(xml).toContain('<xref target="term-event">Event</xref>');
        expect(xml).toContain('<xref target="RFC2119"/>');
        expect(xml).toContain('<bcp14>MUST</bcp14>');
        expect(xml).toContain('reference.RFC.2119.xml');
        expect(xml).toContain('anchor="Adrian2015"');
        expect(xml).toContain('Greenhouse');
        expect(xml).toContain('Security Considerations');
        expect(xml).toContain('IANA Considerations');
        expect(xml).not.toContain('Status of This Memo');
        expect(xml).not.toContain('[[spec-normative:]]');
        expect(terms.map(t => t.term)).toEqual(expect.arrayContaining(['Event', 'greenhouse']));
        expect(Array.isArray(warnings)).toBe(true);
    });

    test('matches the checked-in tiny-spec.xml fixture', () => {
        const markdown = fs.readFileSync(path.join(__dirname, '__fixtures__', 'tiny-spec.md'), 'utf8');
        const expected = fs.readFileSync(path.join(__dirname, '__fixtures__', 'tiny-spec.xml'), 'utf8');
        const spec = {
            title: 'Some Key Terms',
            description: 'Fallback description',
            author: 'Example Org',
            ietf: {
                docName: 'draft-example-terms-00',
                category: 'info',
                ipr: 'trust200902',
                abstract: 'This document sets out some terms.',
                abbrev: 'Terms',
                keyword: ['terminology'],
                date: { year: 2026, month: 'August', day: 31 },
                authors: [{
                    fullname: 'Nigel Davis',
                    initials: 'N.',
                    surname: 'Davis',
                    organization: 'Example',
                    email: 'nigel@example.com',
                    role: 'editor'
                }]
            }
        };
        const { xml } = buildRfcXml(spec, markdown, { now: new Date(Date.UTC(2026, 7, 31)) });
        expect(xml).toBe(expected);
    });

    test('inserts Security and IANA stubs when sections are missing', () => {
        const { xml } = buildRfcXml(tinySpec, 'Hello [[spec: RFC2119]].\n');
        expect(xml).toContain(SECURITY_STUB);
        expect(xml).toContain(IANA_STUB);
        expect(xml).toContain('RFC2119');
    });

    test('renderAuthor and renderFront helpers', () => {
        const author = renderAuthor({
            fullname: 'A B',
            surname: 'B',
            organization: 'Org',
            email: 'a@b.c',
            postal: { city: 'Zurich', country: 'Switzerland' }
        });
        expect(author).toContain('<city>Zurich</city>');
        expect(author).toContain('<email>a@b.c</email>');
        const ietf = {
            title: 'T',
            abbrev: 'T',
            docName: 'draft-x-00',
            authors: [{ fullname: 'A B', surname: 'B' }],
            date: { year: 2026, month: 'August', day: 31 },
            area: '',
            workgroup: '',
            keyword: []
        };
        expect(renderFront(ietf, null)).toContain('No abstract provided.');
    });

    test('ensureRequiredSections is idempotent when flags are set', () => {
        const parts = ensureRequiredSections(['<section anchor="x"><name>X</name></section>'], {
            security: true,
            iana: true,
            terminology: true
        }, '');
        expect(parts).toHaveLength(1);
    });
});
