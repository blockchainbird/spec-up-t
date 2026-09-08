const {
    OPTIONS,
    keyForIndex,
    indexFromChoice,
    menuLines,
    choiceLimit
} = require('./menu');

describe('spec-up-t menu keys', () => {
    test('prints every option with a matching key', () => {
        const lines = menuLines();
        expect(lines).toHaveLength(OPTIONS.length);
        for (const [index, option] of OPTIONS.entries()) {
            expect(lines[index]).toBe(`   [${keyForIndex(index)}] ${option.label}`);
        }
        expect(lines[4]).toContain('Export to RFCXML (IETF)');
        expect(lines[6]).toContain('Collect external references');
        expect(lines[11]).toContain('Freeze specification');
    });

    test('maps digits and letters to option indexes', () => {
        expect(indexFromChoice('4')).toBe(4);
        expect(indexFromChoice('6')).toBe(6);
        expect(indexFromChoice('a')).toBe(10);
        expect(indexFromChoice('B')).toBe(11);
        expect(indexFromChoice('q')).toBe(-1);
        expect(OPTIONS[indexFromChoice('6')].label).toBe('Collect external references');
        expect(OPTIONS[indexFromChoice('4')].label).toBe('Export to RFCXML (IETF)');
    });

    test('accepts extra letter keys once options exceed 0-9', () => {
        expect(choiceLimit()).toContain('A');
        expect(choiceLimit()).toContain('a');
        expect(choiceLimit()).toContain('B');
        expect(choiceLimit()).toContain('q');
        expect(OPTIONS).toHaveLength(12);
    });
});
