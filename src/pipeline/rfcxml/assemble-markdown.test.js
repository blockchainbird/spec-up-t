const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assembleMarkdown, resolveMarkdownPaths, listTermFiles, loadXtrefs } = require('./assemble-markdown');

describe('rfcxml assemble-markdown', () => {
    let root;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfcxml-assemble-'));
        fs.mkdirSync(path.join(root, 'spec', 'terms-definitions'), { recursive: true });
        fs.writeFileSync(path.join(root, 'spec', 'spec-head.md'), '# Head\n');
        fs.writeFileSync(path.join(root, 'spec', 'terms-and-definitions-intro.md'), '## Terminology\n');
        fs.writeFileSync(path.join(root, 'spec', 'spec-body.md'), 'Body [[insert: spec/extra.md]]\n');
        fs.writeFileSync(path.join(root, 'spec', 'extra.md'), 'inserted');
        fs.writeFileSync(path.join(root, 'spec', 'terms-definitions', 'event.md'), '[[def: Event]]\n\n~ An Event.\n');
        fs.writeFileSync(path.join(root, 'spec', 'terms-definitions', '_hidden.md'), 'ignored');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const spec = {
        spec_directory: './spec',
        spec_terms_directory: 'terms-definitions',
        markdown_paths: ['spec-head.md', 'terms-and-definitions-intro.md', 'spec-body.md']
    };

    test('injects term files after the terminology intro', () => {
        const paths = resolveMarkdownPaths(spec, root);
        expect(paths).toContain('terms-definitions/event.md');
        expect(paths.indexOf('terms-definitions/event.md')).toBeGreaterThan(paths.indexOf('terms-and-definitions-intro.md'));
        expect(listTermFiles(path.join(root, 'spec'), 'terms-definitions')).toEqual(['terms-definitions/event.md']);
    });

    test('assembleMarkdown concatenates sources and applies insert replacers', () => {
        const originalCwd = process.cwd();
        process.chdir(root);
        try {
            const { markdown, missing } = assembleMarkdown(spec, root);
            expect(missing).toEqual([]);
            expect(markdown).toContain('# Head');
            expect(markdown).toContain('[[def: Event]]');
            expect(markdown).toContain('inserted');
        } finally {
            process.chdir(originalCwd);
        }
    });

    test('loadXtrefs reads cache or returns empty', () => {
        expect(loadXtrefs(root)).toEqual({ xtrefs: [] });
        fs.mkdirSync(path.join(root, '.cache'));
        fs.writeFileSync(path.join(root, '.cache', 'xtrefs-data.json'), JSON.stringify({ xtrefs: [{ term: 'a' }] }));
        expect(loadXtrefs(root).xtrefs[0].term).toBe('a');
    });

    test('prefers specs-generated.json when present', () => {
        fs.mkdirSync(path.join(root, '.cache'));
        fs.writeFileSync(path.join(root, '.cache', 'specs-generated.json'), JSON.stringify({
            specs: [{ markdown_paths: ['spec-head.md'] }]
        }));
        expect(resolveMarkdownPaths(spec, root)).toEqual(['spec-head.md']);
    });

    test('records missing markdown files and empty term dirs', () => {
        const originalCwd = process.cwd();
        process.chdir(root);
        try {
            const result = assembleMarkdown({
                spec_directory: './spec',
                spec_terms_directory: 'no-such-terms',
                markdown_paths: ['missing.md', 'spec-head.md']
            }, root);
            expect(result.missing).toContain('missing.md');
            expect(result.markdown).toContain('# Head');
            expect(listTermFiles(path.join(root, 'spec'), 'no-such-terms')).toEqual([]);
            expect(listTermFiles(path.join(root, 'spec'), '')).toEqual([]);
        } finally {
            process.chdir(originalCwd);
        }
    });

    test('appends term files when there is no intro path', () => {
        const paths = resolveMarkdownPaths({
            spec_directory: './spec',
            spec_terms_directory: 'terms-definitions',
            markdown_paths: ['spec-head.md']
        }, root);
        expect(paths[paths.length - 1]).toBe('terms-definitions/event.md');
    });
});
