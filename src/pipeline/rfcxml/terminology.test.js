const { createRfcxmlParser } = require('./create-rfcxml-parser');
const {
    collectTermsFromMarkdown,
    buildTermAnchorMap,
    renderTerminologyDl,
    lookupTrefDefinition,
    parseArgs,
    isTermDefinitionLine
} = require('./terminology');

describe('rfcxml terminology', () => {
    const md = createRfcxmlParser();

    test('parseArgs and isTermDefinitionLine', () => {
        expect(parseArgs(' Event, Events ')).toEqual(['Event', 'Events']);
        expect(isTermDefinitionLine('[[def: Event]]')).toBe(true);
        expect(isTermDefinitionLine('Not a term')).toBe(false);
    });

    test('collectTermsFromMarkdown reads def and tref blocks with tilde bodies', () => {
        const markdown = [
            '[[def: Event, Events]]',
            '',
            '~ An Event is a noteworthy occurrence. See [[ref: Fault]].',
            '',
            '[[tref: ExtRef1, greenhouse, Greenhouse]]',
            '',
            '## Next'
        ].join('\n');
        const terms = collectTermsFromMarkdown(markdown, {
            xtrefs: { xtrefs: [{ externalSpec: 'ExtRef1', term: 'greenhouse', content: '<dd>A glass building.</dd>' }] }
        });
        expect(terms).toHaveLength(2);
        expect(terms[0].anchor).toBe('term-event');
        expect(terms[0].definitionMarkdown).toContain('Fault');
        expect(terms[1].type).toBe('tref');
        expect(terms[1].definitionMarkdown).toBe('A glass building.');
    });

    test('lookupTrefDefinition strips HTML', () => {
        expect(lookupTrefDefinition({ xtrefs: [{ externalSpec: 's', term: 't', content: '<dd> Hello </dd>' }] }, 's', 't')).toBe('Hello');
        expect(lookupTrefDefinition(null, 's', 't')).toBe('');
    });

    test('renderTerminologyDl emits RFC 9940-style dt/dd with xref anchors', () => {
        const terms = collectTermsFromMarkdown('[[def: Event, Events]]\n\n~ An Event MUST be logged.\n');
        const ctx = {
            warnings: [],
            termAnchors: buildTermAnchorMap(terms),
            citations: new Map(),
            externalSpecAnchors: new Map()
        };
        const xml = renderTerminologyDl(terms, md, ctx);
        expect(xml).toContain('<dl newline="true" spacing="normal">');
        expect(xml).toContain('anchor="term-event"');
        expect(xml).toContain('Events (Event)');
        expect(xml).toContain('<bcp14>MUST</bcp14>');
        expect(renderTerminologyDl([], md, ctx)).toBe('');
    });
});
