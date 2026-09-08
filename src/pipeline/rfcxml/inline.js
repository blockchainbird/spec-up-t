/**
 * Convert markdown-it inline tokens (and plain markdown snippets) to RFCXML inline markup.
 */

const { escapeXml } = require('./xml-builder');
const { termToAnchor } = require('./term-anchor');
const { classifyCitation } = require('./bibliography');

const BCP14_RE = /\b(MUST NOT|SHALL NOT|SHOULD NOT|NOT RECOMMENDED|MUST|REQUIRED|SHALL|SHOULD|RECOMMENDED|MAY|OPTIONAL)\b/g;

function wrapBcp14(text) {
    return escapeXml(text).replace(BCP14_RE, '<bcp14>$1</bcp14>');
}

function renderTemplateToken(token, ctx) {
    const type = (token.info && token.info.type) || '';
    const args = (token.info && token.info.args) || [];

    if (type === 'ref') {
        const term = args[0] || '';
        const anchor = ctx.termAnchors.get(term.toLowerCase()) || termToAnchor(term);
        return `<xref target="${anchor}">${escapeXml(term)}</xref>`;
    }

    if (type === 'iref') {
        const term = args[0] || '';
        const anchor = ctx.termAnchors.get(term.toLowerCase()) || termToAnchor(term);
        return `<iref item="${escapeXml(term)}"/><xref target="${anchor}">${escapeXml(term)}</xref>`;
    }

    if (type === 'def') {
        const term = args[0] || '';
        const aliases = args.slice(1);
        return escapeXml(aliases[0] || term);
    }

    if (type === 'tref') {
        const term = args[1] || args[0] || '';
        const aliases = args.slice(2);
        const specKey = args[0];
        const label = escapeXml(aliases[0] || term);
        if (specKey && ctx.externalSpecAnchors && ctx.externalSpecAnchors.has(specKey)) {
            return `${label} <xref target="${ctx.externalSpecAnchors.get(specKey)}"/>`;
        }
        return label;
    }

    if (type === 'xref') {
        const specKey = args[0];
        const term = args[1] || '';
        const aliases = args.slice(2);
        const label = escapeXml(aliases[0] || term);
        if (specKey && ctx.externalSpecAnchors && ctx.externalSpecAnchors.has(specKey)) {
            return `<xref target="${ctx.externalSpecAnchors.get(specKey)}">${label}</xref>`;
        }
        return label;
    }

    if (/^spec/i.test(type)) {
        const name = args[0];
        if (!name) {
            return '';
        }
        const classified = classifyCitation(name);
        const anchor = (ctx.citations && ctx.citations.has(classified.anchor))
            ? classified.anchor
            : classified.anchor;
        return `<xref target="${anchor}"/>`;
    }

    return escapeXml(token.content || '');
}

function renderInlineTokens(tokens, ctx) {
    if (!tokens || tokens.length === 0) {
        return '';
    }
    let out = '';
    let linkDepth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        switch (token.type) {
            case 'text':
                out += wrapBcp14(token.content);
                break;
            case 'softbreak':
            case 'hardbreak':
                out += linkDepth > 0 ? ' ' : '<br/>';
                break;
            case 'code_inline':
                out += `<tt>${escapeXml(token.content)}</tt>`;
                break;
            case 'strong_open':
                out += '<strong>';
                break;
            case 'strong_close':
                out += '</strong>';
                break;
            case 'em_open':
                out += '<em>';
                break;
            case 'em_close':
                out += '</em>';
                break;
            case 's_open':
                out += '<em>';
                break;
            case 's_close':
                out += '</em>';
                break;
            case 'link_open': {
                const href = token.attrGet ? token.attrGet('href') : (token.attrs || []).find(a => a[0] === 'href')?.[1];
                linkDepth++;
                out += `<eref target="${escapeXml(href || '')}">`;
                break;
            }
            case 'link_close':
                linkDepth = Math.max(0, linkDepth - 1);
                out += '</eref>';
                break;
            case 'template':
                out += renderTemplateToken(token, ctx);
                break;
            case 'image': {
                const src = token.attrGet ? token.attrGet('src') : '';
                const alt = token.content || '';
                ctx.warnings.push(`Images are not native RFCXML artwork; emitting an eref for ${src || alt}`);
                out += `<eref target="${escapeXml(src || '')}">${escapeXml(alt || src)}</eref>`;
                break;
            }
            case 'html_inline':
                if (/^<br\s*\/?>$/i.test(token.content)) {
                    out += linkDepth > 0 ? ' ' : '<br/>';
                }
                break;
            default:
                if (token.children) {
                    out += renderInlineTokens(token.children, ctx);
                } else if (token.content && token.type === 'text') {
                    out += wrapBcp14(token.content);
                }
                break;
        }
    }
    return out;
}

function renderInlineToken(token, ctx) {
    if (!token) {
        return '';
    }
    if (token.type === 'inline') {
        return renderInlineTokens(token.children || [], ctx);
    }
    return renderInlineTokens([token], ctx);
}

function renderMarkdownInline(md, text, ctx) {
    if (!text || !String(text).trim()) {
        return '';
    }
    const tokens = md.parse(String(text), {});
    return tokens
        .filter(token => token.type === 'inline')
        .map(token => renderInlineToken(token, ctx))
        .filter(Boolean)
        .join(' ');
}

function renderParagraphsFromMarkdown(md, text, ctx) {
    if (!text || !String(text).trim()) {
        return [];
    }
    const tokens = md.parse(String(text), {});
    const paragraphs = [];
    for (const token of tokens) {
        if (token.type === 'inline' && token.children && token.children.length) {
            const inner = renderInlineToken(token, ctx);
            if (inner.trim()) {
                paragraphs.push(`<t>${inner}</t>`);
            }
        }
    }
    return paragraphs;
}

module.exports = {
    wrapBcp14,
    renderTemplateToken,
    renderInlineToken,
    renderMarkdownInline,
    renderParagraphsFromMarkdown
};
