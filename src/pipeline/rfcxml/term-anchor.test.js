const { slugifyTerm, termToAnchor, displayTermLabel, isXmlName, headingToAnchor } = require('./term-anchor');

describe('rfcxml term-anchor', () => {
    test('slugifies terms and strips unsafe characters', () => {
        expect(slugifyTerm('Self-Certifying Identifier')).toBe('self-certifying-identifier');
        expect(slugifyTerm('term/with/slashes')).toBe('term-with-slashes');
        expect(slugifyTerm(' authentic chained data container (ACDC) ')).toBe('authentic-chained-data-container-acdc');
    });

    test('termToAnchor uses term- prefix and is an XML Name', () => {
        expect(termToAnchor('Event')).toBe('term-event');
        expect(termToAnchor('term-event')).toBe('term-event');
        expect(isXmlName(termToAnchor('Event'))).toBe(true);
        expect(isXmlName('term:event')).toBe(false);
        expect(isXmlName('2119')).toBe(false);
    });

    test('displayTermLabel puts aliases first like Spec-Up-T HTML', () => {
        expect(displayTermLabel('soil')).toBe('soil');
        expect(displayTermLabel('soil', ['Soil', 'soils'])).toBe('Soil (soils, soil)');
        expect(displayTermLabel('Event', ['Events'])).toBe('Events (Event)');
    });

    test('headingToAnchor prefixes numeric slugs', () => {
        expect(headingToAnchor('Introduction')).toBe('introduction');
        expect(headingToAnchor('3. Workflow')).toBe('s-3.-workflow');
        expect(isXmlName(headingToAnchor('3. Workflow'))).toBe(true);
    });
});
