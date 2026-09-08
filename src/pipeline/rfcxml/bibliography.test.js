const {
    classifyCitation,
    sanitizeBibliographyAnchor,
    isNormativeSpecType,
    collectCitations,
    renderBibliography,
    renderExplicitReference,
    renderXiInclude,
    lookupCitationAnchor
} = require('./bibliography');

describe('rfcxml bibliography', () => {
    test('classifies RFC, BCP, STD, I-D, and other citations', () => {
        expect(classifyCitation('RFC-2119')).toMatchObject({ kind: 'rfc', anchor: 'RFC2119', number: '2119' });
        expect(classifyCitation('RFC 3877').href).toContain('reference.RFC.3877.xml');
        expect(classifyCitation('BCP14').anchor).toBe('BCP14');
        expect(classifyCitation('STD 7').kind).toBe('std');
        expect(classifyCitation('draft-ssmith-keri')).toMatchObject({
            kind: 'draft',
            anchor: 'I-D.ssmith-keri'
        });
        expect(classifyCitation('I-D.ssmith-keri').href).toContain('reference.I-D.ssmith-keri.xml');
        expect(classifyCitation('Adrian2015')).toMatchObject({ kind: 'other', anchor: 'Adrian2015' });
    });

    test('sanitizeBibliographyAnchor produces XML Names', () => {
        expect(sanitizeBibliographyAnchor('2015 Paper')).toBe('ref-2015-Paper');
        expect(sanitizeBibliographyAnchor('')).toBe('ref');
    });

    test('isNormativeSpecType detects spec-normative tags', () => {
        expect(isNormativeSpecType('spec-normative')).toBe(true);
        expect(isNormativeSpecType('spec')).toBe(false);
    });

    test('collectCitations records spec tags and configured references', () => {
        const tokens = [{
            type: 'inline',
            children: [
                { type: 'template', info: { type: 'spec', args: ['RFC2119'] } },
                { type: 'template', info: { type: 'spec-normative', args: ['RFC8174'] } }
            ]
        }];
        const citations = collectCitations(tokens, {
            references: {
                informative: [{
                    anchor: 'Adrian2015',
                    title: 'Imperfect Forward Secrecy',
                    target: 'https://example.com/adrian2015',
                    date: '2015',
                    authors: [{ fullname: 'D. Adrian' }]
                }]
            }
        });
        expect(citations.get('RFC2119').group).toBe('informative');
        expect(citations.get('RFC8174').group).toBe('normative');
        expect(citations.get('Adrian2015').title).toContain('Imperfect');
    });

    test('renderBibliography emits xi:include for RFCs and explicit references otherwise', () => {
        const citations = collectCitations([], {
            references: {
                normative: ['RFC2119'],
                informative: [{
                    anchor: 'Adrian2015',
                    title: 'Imperfect Forward Secrecy',
                    target: 'https://example.com/adrian2015',
                    authors: ['D. Adrian']
                }]
            }
        });
        const xml = renderBibliography(citations);
        expect(xml).toContain('xi:include');
        expect(xml).toContain('reference.RFC.2119.xml');
        expect(xml).toContain('anchor="Adrian2015"');
        expect(xml).toContain('Imperfect Forward Secrecy');
        expect(renderXiInclude(citations.get('RFC2119'))).toContain('parse="xml"');
    });

    test('lookupCitationAnchor and explicit reference fallbacks', () => {
        expect(lookupCitationAnchor('RFC2119', new Map())).toBe('RFC2119');
        const xml = renderExplicitReference({ anchor: 'KERI', title: 'KERI' });
        expect(xml).toContain('<organization> </organization>');
    });

    test('empty bibliography is an empty string', () => {
        expect(renderBibliography(new Map())).toBe('');
    });
});
