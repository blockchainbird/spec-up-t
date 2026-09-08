/**
 * Walk markdown-it block tokens into RFCXML middle-matter sections.
 */

const { el, escapeXml } = require('./xml-builder');
const { headingToAnchor } = require('./term-anchor');
const { renderInlineToken } = require('./inline');

const SKIP_HEADING_RE = /^(status of this memo|copyright notice|table of contents|authors?'? addresses|colophon)$/i;
const REFERENCES_HEADING_RE = /^(normative\s+references|informative\s+references|references)$/i;
const ABSTRACT_HEADING_RE = /^abstract$/i;
const TERMINOLOGY_HEADING_RE = /^(terminology|terms and definitions|terms)$/i;
const SECURITY_HEADING_RE = /^security considerations$/i;
const IANA_HEADING_RE = /^iana considerations$/i;
const ACK_HEADING_RE = /^acknowledg(e)?ments?$/i;
const APPENDIX_HEADING_RE = /^appendix\b/i;

const UNSUPPORTED_FENCE_RE = /^(mermaid|chart|plantuml|uml|katex)$/i;

function findClose(tokens, start, openType, closeType) {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        if (tokens[i].type === openType) {
            depth++;
        } else if (tokens[i].type === closeType) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return tokens.length - 1;
}

function headingLevel(token) {
    const tag = token.tag || 'h2';
    const n = Number(tag.replace(/[^0-9]/g, '')) || 2;
    return n;
}

function inlineText(token) {
    if (!token) return '';
    if (token.children) {
        return token.children.map(child => child.content || inlineText(child)).join('');
    }
    return token.content || '';
}

function isDefOrTrefTemplate(token) {
    return token && token.type === 'template' && token.info && /^(def|tref)$/i.test(token.info.type);
}

function isTermOnlyParagraph(inlineToken) {
    if (!inlineToken || inlineToken.type !== 'inline' || !inlineToken.children) {
        return false;
    }
    const meaningful = inlineToken.children.filter(child => {
        if (child.type === 'text') {
            return child.content.trim() !== '';
        }
        return child.type !== 'softbreak' && child.type !== 'hardbreak';
    });
    return meaningful.length > 0 && meaningful.every(isDefOrTrefTemplate);
}

function isSkipHtml(token) {
    const content = token.content || '';
    return /terminology-section-start/.test(content) ||
        /<!--\s*file:/.test(content) ||
        /<!--[\s\S]*-->/.test(content.trim());
}

function renderFence(token, ctx) {
    const info = (token.info || '').trim().split(/\s+/)[0] || '';
    if (UNSUPPORTED_FENCE_RE.test(info)) {
        ctx.warnings.push(`Skipping unsupported ${info} diagram; IETF RFCXML cannot execute JavaScript diagrams.`);
        return el('artwork', { type: 'ascii-art' }, escapeXml(`[${info} diagram omitted]`));
    }
    if (info) {
        return el('sourcecode', { type: info }, escapeXml(token.content.replace(/\n$/, '')));
    }
    return el('artwork', { type: 'ascii-art' }, escapeXml(token.content.replace(/\n$/, '')));
}

function renderList(tokens, start, ctx) {
    const open = tokens[start];
    const closeType = open.type.replace('_open', '_close');
    const end = findClose(tokens, start, open.type, closeType);
    const tag = open.type.startsWith('ordered') ? 'ol' : 'ul';
    const items = [];
    let i = start + 1;
    while (i < end) {
        if (tokens[i].type === 'list_item_open') {
            const itemEnd = findClose(tokens, i, 'list_item_open', 'list_item_close');
            const inner = renderTokenRange(tokens, i + 1, itemEnd, ctx);
            items.push(el('li', inner.length ? inner : '<t> </t>'));
            i = itemEnd + 1;
        } else {
            i++;
        }
    }
    return { xml: el(tag, items), next: end + 1 };
}

function wrapT(inner) {
    const text = String(inner || '').trim();
    if (!text) {
        return '';
    }
    if (text.startsWith('<t>') || text.startsWith('<ul') || text.startsWith('<ol') ||
        text.startsWith('<dl') || text.startsWith('<sourcecode') || text.startsWith('<artwork') ||
        text.startsWith('<table') || text.startsWith('<figure') || text.startsWith('<aside') ||
        text.startsWith('<blockquote')) {
        return text;
    }
    return `<t>${inner}</t>`;
}

function renderTable(tokens, start, ctx) {
    const end = findClose(tokens, start, 'table_open', 'table_close');
    const theadCells = [];
    const bodyRows = [];
    let currentRow = null;
    let inHead = false;

    for (let i = start + 1; i < end; i++) {
        const token = tokens[i];
        if (token.type === 'thead_open') inHead = true;
        if (token.type === 'thead_close') inHead = false;
        if (token.type === 'tr_open') currentRow = [];
        if (token.type === 'tr_close' && currentRow) {
            if (inHead || (theadCells.length === 0 && bodyRows.length === 0 && currentRow.length)) {
                if (inHead || theadCells.length === 0) {
                    theadCells.push(...currentRow);
                } else {
                    bodyRows.push(currentRow);
                }
            } else {
                bodyRows.push(currentRow);
            }
            currentRow = null;
        }
        if ((token.type === 'th_open' || token.type === 'td_open') && currentRow) {
            const closeType = token.type.replace('_open', '_close');
            const cellEnd = findClose(tokens, i, token.type, closeType);
            const innerTokens = tokens.slice(i + 1, cellEnd);
            const inline = innerTokens.find(t => t.type === 'inline');
            const cellXml = wrapT(inline ? renderInlineToken(inline, ctx) : '');
            currentRow.push(el(token.type.startsWith('th') ? 'th' : 'td', cellXml || '<t> </t>'));
            i = cellEnd;
        }
    }

    const parts = [];
    if (theadCells.length) {
        parts.push(el('thead', el('tr', theadCells)));
    }
    if (bodyRows.length) {
        parts.push(el('tbody', bodyRows.map(row => el('tr', row))));
    }
    return { xml: el('table', parts), next: end + 1 };
}

function renderDl(tokens, start, ctx) {
    const end = findClose(tokens, start, 'dl_open', 'dl_close');
    let containsTermTag = false;
    for (let i = start; i <= end; i++) {
        const token = tokens[i];
        if (token.type === 'inline' && isTermOnlyParagraph(token)) {
            containsTermTag = true;
        }
        if (token.type === 'template' && isDefOrTrefTemplate(token)) {
            containsTermTag = true;
        }
        if (token.children && token.children.some(isDefOrTrefTemplate)) {
            containsTermTag = true;
        }
    }
    if (containsTermTag) {
        return { xml: '', next: end + 1, skippedTerms: true };
    }

    const items = [];
    let i = start + 1;
    let pendingDt = '';
    while (i < end) {
        const token = tokens[i];
        if (token.type === 'dt_open') {
            const dtEnd = findClose(tokens, i, 'dt_open', 'dt_close');
            const inline = tokens.slice(i, dtEnd).find(t => t.type === 'inline');
            pendingDt = inline ? renderInlineToken(inline, ctx) : '';
            i = dtEnd + 1;
        } else if (token.type === 'dd_open') {
            const ddEnd = findClose(tokens, i, 'dd_open', 'dd_close');
            const inner = renderTokenRange(tokens, i + 1, ddEnd, ctx);
            items.push(el('dt', pendingDt || ' '));
            items.push(el('dd', inner.length ? inner : '<t> </t>'));
            pendingDt = '';
            i = ddEnd + 1;
        } else {
            i++;
        }
    }
    return { xml: items.length ? el('dl', { newline: 'true' }, items) : '', next: end + 1 };
}

function renderTokenRange(tokens, start, end, ctx) {
    const parts = [];
    let i = start;
    while (i < end) {
        const result = walkOne(tokens, i, ctx, end);
        if (result.xml) {
            parts.push(result.xml);
        }
        i = result.next;
    }
    return parts;
}

function walkOne(tokens, i, ctx, end = tokens.length) {
    const token = tokens[i];
    if (!token || i >= end) {
        return { xml: '', next: i + 1 };
    }

    switch (token.type) {
        case 'heading_open': {
            const close = findClose(tokens, i, 'heading_open', 'heading_close');
            const inline = tokens.slice(i, close).find(t => t.type === 'inline');
            const text = inlineText(inline).trim();
            return {
                xml: '',
                next: close + 1,
                heading: { level: headingLevel(token), text, inline }
            };
        }
        case 'paragraph_open': {
            const close = findClose(tokens, i, 'paragraph_open', 'paragraph_close');
            const inline = tokens.slice(i, close).find(t => t.type === 'inline');
            if (inline && isTermOnlyParagraph(inline)) {
                return { xml: '', next: close + 1, skippedTerms: true };
            }
            const inner = inline ? renderInlineToken(inline, ctx) : '';
            return { xml: wrapT(inner), next: close + 1 };
        }
        case 'bullet_list_open':
        case 'ordered_list_open':
            return renderList(tokens, i, ctx);
        case 'blockquote_open': {
            const close = findClose(tokens, i, 'blockquote_open', 'blockquote_close');
            const inner = renderTokenRange(tokens, i + 1, close, ctx);
            return { xml: el('blockquote', inner), next: close + 1 };
        }
        case 'fence':
        case 'code_block':
            return { xml: renderFence(token, ctx), next: i + 1 };
        case 'table_open':
            return renderTable(tokens, i, ctx);
        case 'dl_open':
            return renderDl(tokens, i, ctx);
        case 'hr':
            return { xml: '', next: i + 1 };
        case 'html_block':
            if (isSkipHtml(token)) {
                return { xml: '', next: i + 1 };
            }
            ctx.warnings.push('Skipping raw HTML block in RFCXML export.');
            return { xml: '', next: i + 1 };
        case 'inline':
            return { xml: wrapT(renderInlineToken(token, ctx)), next: i + 1 };
        default: {
            if (token.type.endsWith('_open') && token.type.startsWith('container_')) {
                const closeType = token.type.replace('_open', '_close');
                const close = findClose(tokens, i, token.type, closeType);
                const inner = renderTokenRange(tokens, i + 1, close, ctx);
                return { xml: el('aside', inner), next: close + 1 };
            }
            return { xml: '', next: i + 1 };
        }
    }
}

function collectFlow(tokens, ctx) {
    const flow = [];
    let i = 0;
    while (i < tokens.length) {
        const result = walkOne(tokens, i, ctx);
        if (result.heading) {
            flow.push({ type: 'heading', ...result.heading });
        } else if (result.xml) {
            flow.push({ type: 'block', xml: result.xml });
        }
        i = result.next;
    }
    return flow;
}

function classifyHeading(text) {
    if (ABSTRACT_HEADING_RE.test(text)) return 'abstract';
    if (SKIP_HEADING_RE.test(text)) return 'skip';
    if (REFERENCES_HEADING_RE.test(text)) return 'references';
    if (TERMINOLOGY_HEADING_RE.test(text)) return 'terminology';
    if (SECURITY_HEADING_RE.test(text)) return 'security';
    if (IANA_HEADING_RE.test(text)) return 'iana';
    if (ACK_HEADING_RE.test(text)) return 'acknowledgements';
    if (APPENDIX_HEADING_RE.test(text)) return 'appendix';
    return 'body';
}

function nestSections(flow, options = {}) {
    const abstractParts = [];
    const middle = [];
    const back = [];
    const flags = { security: false, iana: false, terminology: false };

    const stack = [{ level: 0, children: middle, bucket: 'middle' }];

    function current() {
        return stack[stack.length - 1];
    }

    for (let index = 0; index < flow.length; index++) {
        const item = flow[index];
        if (item.type !== 'heading') {
            current().children.push(item);
            continue;
        }

        const kind = classifyHeading(item.text);
        if (kind === 'skip' || kind === 'references') {
            const skipUntil = item.level;
            while (index + 1 < flow.length && !(flow[index + 1].type === 'heading' && flow[index + 1].level <= skipUntil)) {
                index++;
            }
            continue;
        }

        if (kind === 'abstract') {
            while (index + 1 < flow.length && flow[index + 1].type !== 'heading') {
                index++;
                if (flow[index].xml) {
                    abstractParts.push(flow[index].xml);
                }
            }
            continue;
        }

        if (options.title && item.level === 1 && item.text.trim() === String(options.title).trim()) {
            continue;
        }

        while (stack.length > 1 && current().level >= item.level) {
            stack.pop();
        }

        const section = {
            type: 'section',
            level: item.level,
            name: item.text,
            kind,
            anchor: headingToAnchor(item.text),
            children: []
        };

        if (kind === 'acknowledgements' || kind === 'appendix') {
            back.push(section);
            stack.push({ ...section, bucket: 'back' });
        } else {
            current().children.push(section);
            stack.push(section);
        }

        if (kind === 'security') flags.security = true;
        if (kind === 'iana') flags.iana = true;
        if (kind === 'terminology') flags.terminology = true;
    }

    return { abstractParts, middle, back, flags };
}

function renderSection(section, ctx) {
    const body = [];
    for (const child of section.children || []) {
        if (child.type === 'section') {
            body.push(renderSection(child, ctx));
        } else if (child.type === 'block' && child.xml) {
            body.push(child.xml);
        } else if (child.xml) {
            body.push(child.xml);
        }
    }
    if (section.kind === 'terminology' && ctx.terminologyDl) {
        const withoutDup = body.filter(xml => !xml.includes('<dl') || xml.includes('Source:'));
        body.length = 0;
        body.push(...withoutDup);
        body.push(ctx.terminologyDl);
    }
    const attrs = { anchor: section.anchor };
    if (section.kind === 'appendix') {
        attrs.numbered = 'true';
    }
    const inner = [el('name', escapeXml(section.name)), ...body];
    return el('section', attrs, inner);
}

function wrapOrphanBlocks(nodes) {
    const sections = nodes.filter(node => node.type === 'section');
    const orphans = nodes.filter(node => node.type !== 'section');
    if (!orphans.length) {
        return sections;
    }
    const intro = sections.find(section => /^introduction$/i.test(section.name));
    if (intro) {
        intro.children.unshift(...orphans);
        return sections;
    }
    sections.unshift({
        type: 'section',
        level: 2,
        name: 'Introduction',
        kind: 'body',
        anchor: 'introduction',
        children: orphans
    });
    return sections;
}

function renderSectionTree(nodes, ctx) {
    return wrapOrphanBlocks(nodes).map(node => {
        if (node.type === 'section') {
            return renderSection(node, ctx);
        }
        if (node.type === 'block') {
            return node.xml;
        }
        return '';
    }).filter(Boolean);
}

module.exports = {
    collectFlow,
    classifyHeading,
    nestSections,
    wrapOrphanBlocks,
    renderSectionTree,
    wrapT,
    isTermOnlyParagraph
};
