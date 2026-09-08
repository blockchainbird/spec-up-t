/**
 * Optional RFCXML validation and IETF-format rendering via local xml2rfc or
 * the IETF Author Tools API (https://author-tools.ietf.org/).
 */

const fs = require('fs-extra');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const axios = require('axios');

const AUTHOR_TOOLS_BASE = 'https://author-tools.ietf.org/api';

function xml2rfcAvailable() {
    const result = spawnSync('xml2rfc', ['--version'], { encoding: 'utf8', shell: true });
    return result.status === 0;
}

function runXml2rfc(args, cwd) {
    const result = spawnSync('xml2rfc', args, { encoding: 'utf8', shell: true, cwd });
    return {
        ok: result.status === 0,
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error
    };
}

async function validateWithAuthorTools(xml, filename = 'draft.xml') {
    const form = new FormData();
    form.append('file', new Blob([xml], { type: 'application/xml' }), filename);
    const headers = {};
    if (process.env.IETF_API_KEY) {
        headers['X-API-KEY'] = process.env.IETF_API_KEY;
    }
    const response = await axios.post(`${AUTHOR_TOOLS_BASE}/validate`, form, { headers });
    return response.data;
}

async function renderWithAuthorTools(xml, format, filename = 'draft.xml') {
    const form = new FormData();
    form.append('file', new Blob([xml], { type: 'application/xml' }), filename);
    const headers = {};
    if (process.env.IETF_API_KEY) {
        headers['X-API-KEY'] = process.env.IETF_API_KEY;
    }
    const response = await axios.post(`${AUTHOR_TOOLS_BASE}/render/${format}`, form, {
        headers,
        responseType: format === 'pdf' ? 'arraybuffer' : 'json'
    });
    return response.data;
}

async function validateRfcXml(xml, options = {}) {
    const filename = options.filename || 'draft.xml';
    if (options.preferLocal !== false && xml2rfcAvailable()) {
        const tmpDir = options.tmpDir || process.cwd();
        const tmpFile = path.join(tmpDir, filename);
        fs.writeFileSync(tmpFile, xml, 'utf8');
        const result = runXml2rfc([tmpFile, '--out', path.join(tmpDir, 'xml2rfc-validate-out.txt')], tmpDir);
        return {
            engine: 'xml2rfc',
            ok: result.ok,
            output: result.stdout,
            errors: result.ok ? [] : [result.stderr || result.stdout || 'xml2rfc failed']
        };
    }
    if (options.allowRemote === false) {
        return { engine: 'none', ok: true, skipped: true, reason: 'xml2rfc not found and remote validation disabled' };
    }
    try {
        const data = await validateWithAuthorTools(xml, filename);
        const errors = data?.errors || data?.error ? [].concat(data.errors || data.error) : [];
        return {
            engine: 'author-tools',
            ok: errors.length === 0,
            output: data,
            errors
        };
    } catch (error) {
        return {
            engine: 'author-tools',
            ok: false,
            errors: [error.message]
        };
    }
}

async function renderRfcXml(xml, format, options = {}) {
    const filename = options.filename || 'draft.xml';
    const outputPath = options.outputPath;
    if (options.preferLocal !== false && xml2rfcAvailable()) {
        const tmpDir = options.tmpDir || (outputPath ? path.dirname(outputPath) : process.cwd());
        const tmpFile = path.join(tmpDir, filename);
        fs.writeFileSync(tmpFile, xml, 'utf8');
        const flag = format === 'html' ? '--html' : format === 'pdf' ? '--pdf' : '--text';
        const dest = outputPath || path.join(tmpDir, `draft.${format === 'text' ? 'txt' : format}`);
        const result = runXml2rfc([flag, tmpFile, '-o', dest], tmpDir);
        return { engine: 'xml2rfc', ok: result.ok, outputPath: dest, errors: result.ok ? [] : [result.stderr || result.stdout] };
    }
    if (options.allowRemote === false) {
        return { engine: 'none', ok: false, skipped: true, reason: 'xml2rfc not found and remote render disabled' };
    }
    try {
        const data = await renderWithAuthorTools(xml, format === 'text' ? 'text' : format, filename);
        if (outputPath && data) {
            if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
                fs.writeFileSync(outputPath, Buffer.from(data));
            } else if (data.url) {
                const download = await axios.get(data.url, { responseType: 'arraybuffer' });
                fs.writeFileSync(outputPath, Buffer.from(download.data));
            } else if (typeof data === 'string') {
                fs.writeFileSync(outputPath, data, 'utf8');
            } else if (data.content) {
                fs.writeFileSync(outputPath, data.content, 'utf8');
            }
        }
        return { engine: 'author-tools', ok: true, outputPath, output: data, errors: [] };
    } catch (error) {
        return { engine: 'author-tools', ok: false, errors: [error.message] };
    }
}

module.exports = {
    AUTHOR_TOOLS_BASE,
    xml2rfcAvailable,
    validateRfcXml,
    renderRfcXml
};
