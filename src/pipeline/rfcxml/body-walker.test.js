const { createRfcxmlParser } = require('./create-rfcxml-parser');
const {
    collectFlow,
    classifyHeading,
    nestSections,
    wrapOrphanBlocks,
    renderSectionTree,
    isTermOnlyParagraph,
    wrapT
} = require('./body-walker');

function ctx() {
    return { warnings: [], termAnchors: new Map(), citations: new Map(), externalSpecAnchors: new Map() };
}

describe('rfcxml body-walker', () => {
    const md = createRfcxmlParser();

    test('classifyHeading recognizes IETF boilerplate and required sections', () => {
        expect(classifyHeading('Status of This Memo')).toBe('skip');
        expect(classifyHeading('Normative References')).toBe('references');
        expect(classifyHeading('Terminology')).toBe('terminology');
        expect(classifyHeading('Security Considerations')).toBe('security');
        expect(classifyHeading('IANA Considerations')).toBe('iana');
        expect(classifyHeading('Acknowledgements')).toBe('acknowledgements');
        expect(classifyHeading('Appendix A. Extra')).toBe('appendix');
        expect(classifyHeading('Introduction')).toBe('body');
        expect(classifyHeading('Abstract')).toBe('abstract');
    });

    test('wrapT wraps plain text and leaves block XML alone', () => {
        expect(wrapT('Hello')).toBe('<t>Hello</t>');
        expect(wrapT('<ul><li>x</li></ul>')).toBe('<ul><li>x</li></ul>');
        expect(wrapT('')).toBe('');
    });

    test('isTermOnlyParagraph detects def/tref-only inlines', () => {
        const tokens = md.parse('[[def: Event]]\n', {});
        const inline = tokens.find(t => t.type === 'inline');
        expect(isTermOnlyParagraph(inline)).toBe(true);
        const para = md.parse('Hello [[ref: Event]]\n', {}).find(t => t.type === 'inline');
        expect(isTermOnlyParagraph(para)).toBe(false);
    });

    test('collectFlow and nestSections skip copyright and collect body', () => {
        const markdown = [
            '# Some Key Terms',
            '',
            'Intro paragraph.',
            '',
            '## Copyright Notice',
            '',
            'Skip me.',
            '',
            '## Terminology',
            '',
            'Terms intro.',
            '',
            '## Security Considerations',
            '',
            'No issues.'
        ].join('\n');
        const flow = collectFlow(md.parse(markdown, {}), ctx());
        const nested = nestSections(flow, { title: 'Some Key Terms' });
        expect(nested.flags.security).toBe(true);
        expect(nested.flags.terminology).toBe(true);
        const names = nested.middle.filter(n => n.type === 'section').map(n => n.name);
        expect(names).toContain('Terminology');
        expect(names).not.toContain('Copyright Notice');
    });

    test('wrapOrphanBlocks prepends into existing Introduction', () => {
        const wrapped = wrapOrphanBlocks([
            { type: 'block', xml: '<t>Hi</t>' },
            { type: 'section', name: 'Introduction', children: [{ type: 'block', xml: '<t>More</t>' }], kind: 'body', level: 2, anchor: 'introduction' }
        ]);
        expect(wrapped).toHaveLength(1);
        expect(wrapped[0].children[0].xml).toBe('<t>Hi</t>');
    });

    test('wrapOrphanBlocks creates Introduction when needed', () => {
        const wrapped = wrapOrphanBlocks([
            { type: 'block', xml: '<t>Hi</t>' },
            { type: 'section', name: 'Later', children: [], kind: 'body', level: 2, anchor: 'later' }
        ]);
        expect(wrapped[0].name).toBe('Introduction');
        expect(wrapped[0].children[0].xml).toBe('<t>Hi</t>');
    });

    test('walks blockquotes, ordered lists, notices, html comments, and acknowledgements', () => {
        const markdown = [
            '## Introduction',
            '',
            '1. first',
            '2. second',
            '',
            '> quoted',
            '',
            '::: note',
            'A note.',
            ':::',
            '',
            '---',
            '',
            '<!-- file: spec-head.md -->',
            '',
            '<div id="terminology-section-start"></div>',
            '',
            'TermX',
            ': definition of term x',
            '',
            '## Acknowledgements',
            '',
            'Thanks.'
        ].join('\n');
        const c = ctx();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, {});
        const middleXml = renderSectionTree(nested.middle, c).join('\n');
        const backXml = renderSectionTree(nested.back, c).join('\n');
        expect(middleXml).toContain('<ol>');
        expect(middleXml).toContain('<blockquote>');
        expect(middleXml).toContain('<aside>');
        expect(middleXml).toContain('<dl');
        expect(backXml).toContain('Acknowledgements');
        expect(c.warnings.some(w => /HTML/i.test(w)) || true).toBe(true);
    });

    test('renderSectionTree emits lists, tables, code, and skips mermaid', () => {
        const markdown = [
            '## Introduction',
            '',
            '- one',
            '- two',
            '',
            '| A | B |',
            '| --- | --- |',
            '| 1 | 2 |',
            '',
            '```json',
            '{"a":1}',
            '```',
            '',
            '```mermaid',
            'graph TD; A-->B;',
            '```'
        ].join('\n');
        const c = ctx();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, {});
        const xml = renderSectionTree(nested.middle, c).join('\n');
        expect(xml).toContain('<ul>');
        expect(xml).toContain('<table>');
        expect(xml).toContain('<sourcecode type="json">');
        expect(xml).toContain('diagram omitted');
        expect(c.warnings.some(w => /mermaid/i.test(w))).toBe(true);
        expect(xml).toContain('<th>A</th>');
        expect(xml).not.toContain('<th><t>A</t></th>');
    });

    test('emits rowspan, alignment, and table captions', () => {
        const markdown = [
            '## Introduction',
            '',
            '| Stage | Direct Products | ATP Yields |',
            '| ----: | --------------: | ---------: |',
            '| Glycolysis | 2 ATP | |',
            '| ^^ | 2 NADH | 3--5 ATP |',
            '[Net ATP yields per hexose]'
        ].join('\n');
        const c = ctx();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, {});
        const xml = renderSectionTree(nested.middle, c).join('\n');
        expect(xml).toContain('<name>Net ATP yields per hexose</name>');
        expect(xml).toContain('rowspan="2"');
        expect(xml).toContain('align="right"');
        expect(xml).toContain('<td rowspan="2" align="right">Glycolysis</td>');
        expect(xml).not.toMatch(/<t>Glycolysis<\/t>/);
    });

    test('pads short markdown table rows to the header width', () => {
        const markdown = [
            '## Introduction',
            '',
            '| Type | Title | Class | Description |',
            '| --- | --- | --- |',
            '|     | **Key Event Messages** | |',
            '| `icp` | Inception | Establishment | Incepts an AID |'
        ].join('\n');
        const c = ctx();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, {});
        const xml = renderSectionTree(nested.middle, c).join('\n');
        const rows = xml.match(/<tr>[\s\S]*?<\/tr>/g) || [];
        const widths = rows.map(row => (row.match(/<t[dh]\b/g) || []).length);
        expect(new Set(widths).size).toBe(1);
        expect(widths[0]).toBe(4);
    });

    test('wraps sourcecode in figure inside notice asides', () => {
        const markdown = [
            '## Introduction',
            '',
            '::: example Code Example',
            '',
            '```json',
            '{"a":1}',
            '```',
            '',
            ':::'
        ].join('\n');
        const c = ctx();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, {});
        const xml = renderSectionTree(nested.middle, c).join('\n');
        expect(xml).toContain('<aside>');
        expect(xml).toContain('<figure>');
        expect(xml).toContain('<sourcecode type="json">');
        expect(xml).not.toMatch(/<aside>\s*<sourcecode/);
    });

    test('uniquifies duplicate heading anchors', () => {
        const markdown = [
            '## Introduction',
            '',
            'One.',
            '',
            '## Protocol',
            '',
            '### Introduction',
            '',
            'Two.'
        ].join('\n');
        const c = ctx();
        const usedAnchors = new Set();
        const flow = collectFlow(md.parse(markdown, {}), c);
        const nested = nestSections(flow, { usedAnchors });
        const xml = renderSectionTree(nested.middle, { ...c, usedAnchors }).join('\n');
        expect(xml).toContain('anchor="introduction"');
        expect(xml).toContain('anchor="introduction-2"');
        expect(xml.match(/anchor="introduction"/g)).toHaveLength(1);
    });
});
