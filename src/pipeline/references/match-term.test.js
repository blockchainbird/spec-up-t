const { matchTerm } = require('./match-term');

// Tests for matching terms within definition markup
describe('matchTerm', () => {
    // Test: Can the system find terms that exist in definition markup?
    test('returns true when the term is found in a correctly formatted definition', () => {
        const text = '[[def: term1, term2]]\nSome additional text';
        expect(matchTerm(text, 'term1')).toBe(true);
        expect(matchTerm(text, 'term2')).toBe(true);
    });

    // Test: Does the system correctly identify when a term is not present?
    test('returns false when the term is not found in the definition', () => {
        const text = '[[def: term1, term2]]\nSome additional text';
        expect(matchTerm(text, 'term3')).toBe(false);
    });

    // Test: Does the system handle invalid input gracefully?
    test('returns false when the text is null or not a string', () => {
        expect(matchTerm(null, 'term1')).toBe(false);
        expect(matchTerm(123, 'term1')).toBe(false);
    });

    // Test: Does the system require proper definition markup format?
    test('returns false when the first line is not a valid definition', () => {
        const text = 'Invalid definition line\n[[def: term1, term2]]';
        expect(matchTerm(text, 'term1')).toBe(false);
    });

    // Test: Can the system handle whitespace variations in markup?
    test('handles extra spaces correctly', () => {
        const text = '[[def:   term1  ,   term2   ]]';
        expect(matchTerm(text, 'term1')).toBe(true);
        expect(matchTerm(text, 'term2')).toBe(true);
    });
});
