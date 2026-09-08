process.env.RFCXML_NO_CLI = '1';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportRfcXml } = require('../../create-rfcxml');
const { IetfConfigError } = require('./ietf-config');
const { createRfcxmlParser, NOTICE_TYPES } = require('./create-rfcxml-parser');
const { configScriptsKeys } = require('../../install-from-boilerplate/config-scripts-keys');

describe('rfcxml export entry', () => {
    test('createRfcxmlParser parses template tags', () => {
        const md = createRfcxmlParser();
        const tokens = md.parse('Hello [[ref: Event]]', {});
        const inline = tokens.find(t => t.type === 'inline');
        const template = inline.children.find(c => c.type === 'template');
        expect(template.info.type).toBe('ref');
        expect(NOTICE_TYPES.note).toBe(1);
    });

    test('npm scripts include torfcxml and torfc', () => {
        expect(configScriptsKeys.torfcxml).toContain('create-rfcxml.js');
        expect(configScriptsKeys.torfc).toContain("RFCXML_RENDER='1'");
    });

    test('exportRfcXml writes docName.xml', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfcxml-export-'));
        fs.mkdirSync(path.join(root, 'spec'), { recursive: true });
        fs.writeFileSync(path.join(root, 'spec', 'spec-head.md'), '# Tiny\n\nHello [[spec: RFC2119]].\n');
        fs.writeFileSync(path.join(root, 'specs.json'), JSON.stringify({
            specs: [{
                title: 'Tiny',
                spec_directory: './spec',
                spec_terms_directory: 'terms-definitions',
                output_path: './docs',
                markdown_paths: ['spec-head.md'],
                ietf: {
                    docName: 'draft-example-tiny-00',
                    category: 'info',
                    ipr: 'trust200902',
                    abstract: 'Tiny abstract.',
                    date: '2026-08-31',
                    authors: [{ fullname: 'A. Author', surname: 'Author', organization: 'Org' }]
                }
            }]
        }));

        const originalCwd = process.cwd();
        process.chdir(root);
        try {
            const outputs = await exportRfcXml({ cwd: root, now: new Date(Date.UTC(2026, 7, 31)) });
            expect(outputs).toHaveLength(1);
            expect(fs.existsSync(path.join(root, 'docs', 'draft-example-tiny-00.xml'))).toBe(true);
            const xml = fs.readFileSync(path.join(root, 'docs', 'draft-example-tiny-00.xml'), 'utf8');
            expect(xml).toContain('docName="draft-example-tiny-00"');
            expect(xml).toContain('target="RFC2119"');
        } finally {
            process.chdir(originalCwd);
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('exportRfcXml throws without ietf block', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfcxml-export-missing-'));
        fs.writeFileSync(path.join(root, 'specs.json'), JSON.stringify({ specs: [{ title: 'No IETF' }] }));
        await expect(exportRfcXml({ cwd: root })).rejects.toThrow(IetfConfigError);
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('exportRfcXml throws without specs.json', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfcxml-nospecs-'));
        await expect(exportRfcXml({ cwd: root })).rejects.toThrow(/specs.json not found/);
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('maybeValidateAndRender skips remote validation when disabled', async () => {
        const { maybeValidateAndRender } = require('../../create-rfcxml');
        const previous = process.env.RFCXML_ALLOW_REMOTE;
        process.env.RFCXML_ALLOW_REMOTE = '0';
        await expect(maybeValidateAndRender([{
            xml: '<rfc/>',
            filename: 'draft.xml',
            outputPath: path.join(os.tmpdir(), 'draft.xml'),
            ietf: { docName: 'draft-x' }
        }], { validate: true })).resolves.toBeUndefined();
        if (previous === undefined) {
            delete process.env.RFCXML_ALLOW_REMOTE;
        } else {
            process.env.RFCXML_ALLOW_REMOTE = previous;
        }
    });
});
