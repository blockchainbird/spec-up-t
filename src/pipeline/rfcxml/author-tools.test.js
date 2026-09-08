jest.mock('axios', () => ({
    post: jest.fn(),
    get: jest.fn()
}));

jest.mock('node:child_process', () => ({
    spawnSync: jest.fn()
}));

const axios = require('axios');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    xml2rfcAvailable,
    validateRfcXml,
    renderRfcXml,
    AUTHOR_TOOLS_BASE
} = require('./author-tools');

describe('rfcxml author-tools', () => {
    let tmp;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rfcxml-at-'));
        spawnSync.mockReset();
        axios.post.mockReset();
        axios.get.mockReset();
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test('xml2rfcAvailable reflects spawn status', () => {
        spawnSync.mockReturnValue({ status: 0, stdout: 'xml2rfc 3.29.0' });
        expect(xml2rfcAvailable()).toBe(true);
        spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'not found' });
        expect(xml2rfcAvailable()).toBe(false);
    });

    test('validateRfcXml uses local xml2rfc when available', async () => {
        spawnSync.mockImplementation((cmd, args) => {
            if (args && args[0] === '--version') {
                return { status: 0, stdout: '3' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        });
        const result = await validateRfcXml('<rfc/>', { filename: 'draft.xml', tmpDir: tmp });
        expect(result.engine).toBe('xml2rfc');
        expect(result.ok).toBe(true);
        expect(fs.existsSync(path.join(tmp, 'draft.xml'))).toBe(true);
    });

    test('validateRfcXml falls back to Author Tools', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValue({ data: { errors: [] } });
        const result = await validateRfcXml('<rfc/>', { filename: 'draft.xml', preferLocal: true });
        expect(result.engine).toBe('author-tools');
        expect(result.ok).toBe(true);
        expect(axios.post).toHaveBeenCalledWith(
            `${AUTHOR_TOOLS_BASE}/validate`,
            expect.anything(),
            expect.any(Object)
        );
    });

    test('validateRfcXml can skip remote', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        const result = await validateRfcXml('<rfc/>', { allowRemote: false });
        expect(result.skipped).toBe(true);
    });

    test('renderRfcXml writes local xml2rfc output', async () => {
        spawnSync.mockImplementation((cmd, args) => {
            if (args && args[0] === '--version') return { status: 0, stdout: '3' };
            return { status: 0, stdout: '', stderr: '' };
        });
        const dest = path.join(tmp, 'draft.html');
        const result = await renderRfcXml('<rfc/>', 'html', { filename: 'draft.xml', outputPath: dest, tmpDir: tmp });
        expect(result.ok).toBe(true);
        expect(result.engine).toBe('xml2rfc');
    });

    test('renderRfcXml uses Author Tools and downloads url', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValue({ data: { url: 'https://example.com/out.html' } });
        axios.get.mockResolvedValue({ data: Buffer.from('<html></html>') });
        const dest = path.join(tmp, 'out.html');
        const result = await renderRfcXml('<rfc/>', 'html', { outputPath: dest, allowRemote: true, preferLocal: true });
        expect(result.ok).toBe(true);
        expect(fs.readFileSync(dest, 'utf8')).toContain('<html>');
    });

    test('Author Tools errors are returned', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockRejectedValue(new Error('network'));
        const result = await validateRfcXml('<rfc/>');
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toBe('network');
    });

    test('validateRfcXml reports xml2rfc failure', async () => {
        spawnSync.mockImplementation((cmd, args) => {
            if (args && args[0] === '--version') return { status: 0, stdout: '3' };
            return { status: 1, stdout: '', stderr: 'schema error' };
        });
        const result = await validateRfcXml('<rfc/>', { filename: 'draft.xml', tmpDir: tmp });
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toContain('schema error');
    });

    test('validateRfcXml records Author Tools error list', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValue({ data: { errors: ['bad xml'] } });
        const result = await validateRfcXml('<rfc/>');
        expect(result.ok).toBe(false);
        expect(result.errors).toContain('bad xml');
    });

    test('renderRfcXml can skip remote', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        const result = await renderRfcXml('<rfc/>', 'text', { allowRemote: false });
        expect(result.skipped).toBe(true);
    });

    test('renderRfcXml writes Author Tools content string', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValue({ data: { content: 'Internet-Draft' } });
        const dest = path.join(tmp, 'draft.txt');
        const result = await renderRfcXml('<rfc/>', 'text', { outputPath: dest });
        expect(result.ok).toBe(true);
        expect(fs.readFileSync(dest, 'utf8')).toBe('Internet-Draft');
    });

    test('renderRfcXml writes string payload and pdf arraybuffer', async () => {
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValueOnce({ data: 'plain' });
        const txt = path.join(tmp, 'a.txt');
        await renderRfcXml('<rfc/>', 'text', { outputPath: txt });
        expect(fs.readFileSync(txt, 'utf8')).toBe('plain');

        axios.post.mockResolvedValueOnce({ data: Buffer.from('%PDF') });
        const pdf = path.join(tmp, 'a.pdf');
        await renderRfcXml('<rfc/>', 'pdf', { outputPath: pdf });
        expect(fs.readFileSync(pdf)).toEqual(Buffer.from('%PDF'));
    });

    test('renderRfcXml local xml2rfc failure', async () => {
        spawnSync.mockImplementation((cmd, args) => {
            if (args && args[0] === '--version') return { status: 0, stdout: '3' };
            return { status: 1, stderr: 'pdf failed', stdout: '' };
        });
        const result = await renderRfcXml('<rfc/>', 'pdf', { filename: 'draft.xml', outputPath: path.join(tmp, 'x.pdf'), tmpDir: tmp });
        expect(result.ok).toBe(false);
    });

    test('Author Tools sends IETF_API_KEY', async () => {
        process.env.IETF_API_KEY = 'secret';
        spawnSync.mockReturnValue({ status: 1 });
        axios.post.mockResolvedValue({ data: { errors: [] } });
        await validateRfcXml('<rfc/>');
        expect(axios.post.mock.calls[0][2].headers['X-API-KEY']).toBe('secret');
        delete process.env.IETF_API_KEY;
    });
});
