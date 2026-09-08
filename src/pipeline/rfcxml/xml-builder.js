/**
 * Minimal RFCXML helpers: escaping, attribute formatting, and element assembly.
 */

const ESCAPED_TAG_PLACEHOLDER = '__SPEC_UP_ESCAPED_TAG__';

function restoreEscapes(text) {
    return String(text ?? '').replaceAll(ESCAPED_TAG_PLACEHOLDER, '[[');
}

function escapeXml(text) {
    return restoreEscapes(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeAttr(text) {
    return escapeXml(text).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function formatAttrs(attrs) {
    if (!attrs) {
        return '';
    }
    return Object.entries(attrs)
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .map(([key, value]) => {
            if (value === true) {
                return ` ${key}="true"`;
            }
            return ` ${key}="${escapeAttr(String(value))}"`;
        })
        .join('');
}

function indentBlock(text, level) {
    const pad = '  '.repeat(level);
    return String(text)
        .split('\n')
        .map(line => (line.length ? pad + line : line))
        .join('\n');
}

/**
 * Build an XML element. `content` may be a string, an array of strings, or omitted (empty element).
 */
function el(name, attrs, content) {
    const attrStr = formatAttrs(typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {});
    const body = arguments.length === 2 && (typeof attrs === 'string' || Array.isArray(attrs))
        ? attrs
        : content;

    if (body === undefined || body === null || body === '') {
        return `<${name}${attrStr}/>`;
    }

    const inner = Array.isArray(body) ? body.filter(part => part != null && part !== '').join('\n') : String(body);

    if (name === 'sourcecode' || name === 'artwork') {
        return `<${name}${attrStr}>\n${inner}\n</${name}>`;
    }

    if (!inner.includes('\n')) {
        return `<${name}${attrStr}>${inner}</${name}>`;
    }

    return `<${name}${attrStr}>\n${indentBlock(inner, 1)}\n</${name}>`;
}

module.exports = {
    restoreEscapes,
    escapeXml,
    escapeAttr,
    formatAttrs,
    indentBlock,
    el
};
