const { createRfcxmlParser } = require('./create-rfcxml-parser');
const {
    wrapBcp14,
    renderInlineToken,
    renderTemplateToken,
    renderMarkdownInline,
    renderParagraphsFromMarkdown
} = require('./inline');

function ctx(overrides = {}) {
    return {
        warnings: [],
        termAnchors: new Map([['event', 'term-event']]),
        citations: new Map([['RFC2119', { anchor: 'RFC2119' }]]),
        externalSpecAnchors: new Map([['ExtRef1', 'ExtRef1']]),
        ...overrides
    };
}

describe('rfcxml inline', () => {
    const md = createRfcxmlParser();

    test('wrapBcp14 tags RFC 2119 words', () => {
        expect(wrapBcp14('Implementations MUST NOT fail')).toBe(
            'Implementations <bcp14>MUST NOT</bcp14> fail'
        );
        expect(wrapBcp14('a < b')).toBe('a &lt; b');
    });

    test('renderTemplateToken maps ref, spec, xref, tref, iref', () => {
        const c = ctx();
        expect(renderTemplateToken({ info: { type: 'ref', args: ['Event'] } }, c)).toBe(
            '<xref target="term-event">Event</xref>'
        );
        expect(renderTemplateToken({ info: { type: 'spec', args: ['RFC2119'] } }, c)).toBe(
            '<xref target="RFC2119"/>'
        );
        expect(renderTemplateToken({ info: { type: 'xref', args: ['ExtRef1', 'greenhouse'] } }, c)).toContain(
            'target="ExtRef1"'
        );
        expect(renderTemplateToken({ info: { type: 'tref', args: ['ExtRef1', 'greenhouse'] } }, c)).toContain(
            '<xref target="ExtRef1"/>'
        );
        expect(renderTemplateToken({ info: { type: 'iref', args: ['Event'] } }, c)).toContain('<iref item="Event"/>');
        expect(renderTemplateToken({ info: { type: 'def', args: ['Event', 'Events'] } }, c)).toBe('Events');
        expect(renderTemplateToken({ info: { type: 'spec-normative' } }, c)).toBe('');
    });

    test('renderInlineToken handles emphasis, code, links, and template tags', () => {
        const tokens = md.parse('See **bold** and `code` and [IETF](https://www.ietf.org/) and [[ref: Event]].', {});
        const inline = tokens.find(t => t.type === 'inline');
        const xml = renderInlineToken(inline, ctx());
        expect(xml).toContain('<strong>bold</strong>');
        expect(xml).toContain('<tt>code</tt>');
        expect(xml).toContain('<eref target="https://www.ietf.org/">IETF</eref>');
        expect(xml).toContain('<xref target="term-event">Event</xref>');
    });

    test('line breaks inside markdown links become spaces, not br', () => {
        const tokens = md.parse('[Concise Binary Object Representation (CBOR)\n](https://www.rfc-editor.org/rfc/rfc8949.html)', {});
        const inline = tokens.find(t => t.type === 'inline');
        const xml = renderInlineToken(inline, ctx());
        expect(xml).toContain('<eref target="https://www.rfc-editor.org/rfc/rfc8949.html">');
        expect(xml).not.toMatch(/<eref[^>]*>[\s\S]*<br\/>/);
        expect(xml).toContain('CBOR');
    });

    test('renderMarkdownInline and paragraphs', () => {
        const c = ctx();
        expect(renderMarkdownInline(md, 'Hello MUST', c)).toContain('<bcp14>MUST</bcp14>');
        expect(renderParagraphsFromMarkdown(md, 'One.\n\nTwo.', c).length).toBeGreaterThanOrEqual(1);
        expect(renderMarkdownInline(md, '', c)).toBe('');
        expect(renderParagraphsFromMarkdown(md, '', c)).toEqual([]);
    });

    test('html_inline br and unknown template fall back', () => {
        const c = ctx();
        expect(renderInlineToken({
            type: 'inline',
            children: [
                { type: 'html_inline', content: '<br>' },
                { type: 'template', info: { type: 'unknown' }, content: 'x' },
                { type: 's_open' },
                { type: 'text', content: 'gone' },
                { type: 's_close' }
            ]
        }, c)).toContain('<br/>');
    });

    test('images become erefs and warn', () => {
        const c = ctx();
        const tokens = md.parse('![alt](https://example.com/x.png)', {});
        const inline = tokens.find(t => t.type === 'inline');
        const xml = renderInlineToken(inline, c);
        expect(xml).toContain('eref');
        expect(c.warnings.length).toBeGreaterThan(0);
    });
});
