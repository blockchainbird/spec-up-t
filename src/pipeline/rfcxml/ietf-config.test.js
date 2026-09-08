const {
    IetfConfigError,
    parseDate,
    normalizeAuthor,
    normalizeIetfConfig,
    requireIetfBlock,
    MONTH_NAMES
} = require('./ietf-config');

const validIetf = {
    docName: 'draft-example-terms-00',
    category: 'info',
    ipr: 'trust200902',
    authors: [{ fullname: 'A. Author', surname: 'Author', organization: 'Org', email: 'a@example.com' }]
};

describe('rfcxml ietf-config', () => {
    test('requireIetfBlock throws without ietf', () => {
        expect(() => requireIetfBlock({})).toThrow(IetfConfigError);
        expect(requireIetfBlock({ ietf: validIetf })).toBe(validIetf);
    });

    test('parseDate handles ISO strings, objects, and fallbacks', () => {
        expect(parseDate('2026-08-31')).toEqual({ year: 2026, month: 'August', day: 31 });
        expect(parseDate({ year: 2026, month: 8, day: 1 })).toEqual({ year: 2026, month: 'August', day: 1 });
        const fallback = parseDate(null, new Date(Date.UTC(2026, 0, 15)));
        expect(fallback.year).toBe(2026);
        expect(fallback.month).toBe(MONTH_NAMES[0]);
        expect(() => parseDate('not-a-date')).toThrow(IetfConfigError);
        expect(() => parseDate({})).toThrow(IetfConfigError);
    });

    test('normalizeAuthor requires a name', () => {
        expect(() => normalizeAuthor({}, 0)).toThrow(/fullname or surname/);
        expect(normalizeAuthor({ initials: 'N.', surname: 'Davis' }, 0).fullname).toBe('N. Davis');
    });

    test('normalizeIetfConfig fills defaults from the spec', () => {
        const spec = { title: 'Key Terms', description: 'An abstract.', ietf: validIetf };
        const normalized = normalizeIetfConfig(spec, new Date(Date.UTC(2026, 7, 31)));
        expect(normalized.title).toBe('Key Terms');
        expect(normalized.abstract).toBe('An abstract.');
        expect(normalized.submissionType).toBe('IETF');
        expect(normalized.consensus).toBe(false);
        expect(normalized.tocInclude).toBe(true);
        expect(normalized.authors[0].surname).toBe('Author');
    });

    test('normalizeIetfConfig rejects invalid category and missing authors', () => {
        expect(() => normalizeIetfConfig({ ietf: { ...validIetf, category: 'foo' } })).toThrow(/category/);
        expect(() => normalizeIetfConfig({ ietf: { ...validIetf, authors: [] } })).toThrow(/authors/);
        expect(() => normalizeIetfConfig({ ietf: { ...validIetf, docName: '' } })).toThrow(/docName/);
        expect(() => normalizeIetfConfig({ ietf: { ...validIetf, ipr: '' } })).toThrow(/ipr/);
        expect(() => normalizeIetfConfig({ ietf: { ...validIetf, submissionType: 'NASA' } })).toThrow(/submissionType/);
    });

    test('keyword may be a string', () => {
        const normalized = normalizeIetfConfig({
            ietf: { ...validIetf, keyword: 'terminology', consensus: 'yes', date: '2026-08-31' }
        });
        expect(normalized.keyword).toEqual(['terminology']);
        expect(normalized.consensus).toBe(true);
        expect(normalized.date.month).toBe('August');
    });
});
