const { escapeXml, escapeAttr, formatAttrs, indentBlock, el, restoreEscapes } = require('./xml-builder');

describe('rfcxml xml-builder', () => {
    test('escapes XML text and restores escaped Spec-Up tags', () => {
        expect(escapeXml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
        expect(restoreEscapes('__SPEC_UP_ESCAPED_TAG__def: x]]')).toBe('[[def: x]]');
        expect(escapeXml('__SPEC_UP_ESCAPED_TAG__def: x]]')).toBe('[[def: x]]');
    });

    test('escapes attribute quotes', () => {
        expect(escapeAttr('say "hi"')).toBe('say &quot;hi&quot;');
    });

    test('formatAttrs skips nullish and false', () => {
        expect(formatAttrs({ a: '1', b: null, c: false, d: true })).toBe(' a="1" d="true"');
    });

    test('indentBlock prefixes non-empty lines', () => {
        expect(indentBlock('a\n\nb', 1)).toBe('  a\n\n  b');
    });

    test('el builds nested and self-closing elements', () => {
        expect(el('br')).toBe('<br/>');
        expect(el('name', 'Intro')).toBe('<name>Intro</name>');
        expect(el('dt', { anchor: 'term-event' }, 'Event')).toBe('<dt anchor="term-event">Event</dt>');
        expect(el('section', { anchor: 'intro' }, ['<name>Intro</name>', '<t>Hi</t>'])).toContain('<section anchor="intro">');
        expect(el('section', { anchor: 'intro' }, ['<name>Intro</name>', '<t>Hi</t>'])).toContain('<t>Hi</t>');
    });

    test('el two-argument string form is content not attributes', () => {
        expect(el('organization', 'IETF')).toBe('<organization>IETF</organization>');
    });

    test('sourcecode and artwork keep inner whitespace unindented', () => {
        const xml = el('sourcecode', { type: 'json' }, '{\n  "a": 1\n}');
        expect(xml).toBe('<sourcecode type="json">\n{\n  "a": 1\n}\n</sourcecode>');
    });
});
