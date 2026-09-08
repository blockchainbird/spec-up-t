/**
 * Load and concatenate Spec-Up-T markdown sources the same way the HTML renderer does,
 * without mutating files or requiring a prior HTML render.
 */

const fs = require('fs-extra');
const path = require('node:path');
const { shouldProcessFile } = require('../../utils/file-filter');
const { processEscapedTags } = require('../preprocessing/escape-placeholder-utils');
const { applyReplacers } = require('../rendering/render-utils');

function listTermFiles(specDir, termsDirName) {
    if (!termsDirName) {
        return [];
    }
    const termsDir = path.join(specDir, termsDirName);
    if (!fs.existsSync(termsDir)) {
        return [];
    }
    return fs.readdirSync(termsDir)
        .filter(shouldProcessFile)
        .sort((a, b) => a.localeCompare(b))
        .map(file => path.join(termsDirName, file));
}

function resolveMarkdownPaths(spec, cwd = process.cwd()) {
    const paths = [...(spec.markdown_paths || ['spec.md'])];
    const generatedPath = path.join(cwd, '.cache', 'specs-generated.json');
    if (fs.existsSync(generatedPath)) {
        try {
            const generated = fs.readJsonSync(generatedPath);
            const generatedPaths = generated?.specs?.[0]?.markdown_paths;
            if (Array.isArray(generatedPaths) && generatedPaths.length) {
                return generatedPaths;
            }
        } catch {
            // Fall through to local resolution.
        }
    }

    const termFiles = listTermFiles(path.resolve(cwd, spec.spec_directory || '.'), spec.spec_terms_directory);
    if (!termFiles.length) {
        return paths;
    }
    const introIndex = paths.indexOf('terms-and-definitions-intro.md');
    if (introIndex !== -1) {
        const next = [...paths];
        next.splice(introIndex + 1, 0, ...termFiles);
        return next;
    }
    return [...paths, ...termFiles];
}

function loadXtrefs(cwd = process.cwd()) {
    const xtrefsPath = path.join(cwd, '.cache', 'xtrefs-data.json');
    if (!fs.existsSync(xtrefsPath)) {
        return { xtrefs: [] };
    }
    try {
        return fs.readJsonSync(xtrefsPath);
    } catch {
        return { xtrefs: [] };
    }
}

function assembleMarkdown(spec, cwd = process.cwd()) {
    const specDir = path.resolve(cwd, spec.spec_directory || '.');
    const relPaths = resolveMarkdownPaths(spec, cwd);
    const docs = [];
    const missing = [];

    for (const rel of relPaths) {
        const full = path.join(specDir, rel);
        if (!fs.existsSync(full)) {
            missing.push(rel);
            continue;
        }
        docs.push(fs.readFileSync(full, 'utf8'));
    }

    let markdown = docs.join('\n\n');
    markdown = processEscapedTags(markdown);
    markdown = applyReplacers(markdown);
    return { markdown, paths: relPaths, missing };
}

module.exports = {
    listTermFiles,
    resolveMarkdownPaths,
    loadXtrefs,
    assembleMarkdown
};
