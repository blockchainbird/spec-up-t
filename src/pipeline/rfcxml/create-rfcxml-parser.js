/**
 * Lightweight markdown-it parser for RFCXML export.
 * Intentionally omits HTML-only plugins (TOC, Prism, KaTeX, charts).
 */

const MarkdownIt = require('markdown-it');
const containers = require('markdown-it-container');
const applyTemplateTagSyntax = require('../../markdown-it/template-tag-syntax');
const { templateTags } = require('../../utils/regex-patterns');

const NOTICE_TYPES = {
    note: 1,
    issue: 1,
    example: 1,
    warning: 1,
    todo: 1,
    informative: 1
};

function createRfcxmlParser() {
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
    });

    applyTemplateTagSyntax(md, [
        {
            filter: type => templateTags.terminology.test(type)
        },
        {
            filter: type => templateTags.specName.test(type)
        }
    ]);

    md.use(require('markdown-it-deflist'));
    md.use(require('markdown-it-sub'));
    md.use(require('markdown-it-sup'));
    md.use(require('markdown-it-ins'));
    md.use(require('markdown-it-mark'));
    md.use(require('markdown-it-multimd-table'), {
        multiline: true,
        rowspan: true,
        headerless: true
    });

    md.use(containers, 'notice', {
        validate(params) {
            const matches = params.match(/(\w+)\s?(.*)?/);
            return matches && NOTICE_TYPES[matches[1]];
        },
        render(tokens, idx) {
            return tokens[idx].nesting === 1 ? '' : '';
        }
    });

    return md;
}

module.exports = {
    createRfcxmlParser,
    NOTICE_TYPES
};
