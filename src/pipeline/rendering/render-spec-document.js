/**
 * Handles the core rendering logic for a single spec.
 * Processes markdown files, renders HTML, applies fixes, and writes output.
 * It takes shared variables and config as parameters to maintain modularity.
 */

const fs = require('fs-extra');
const path = require('path');

const { fetchExternalSpecs, validateReferences, mergeXrefTermsIntoAllXTrefs } = require('../references/external-references-service.js');
const { processEscapedTags, restoreEscapedTags } = require('../preprocessing/escape-placeholder-utils.js');
const { sortDefinitionTermsInHtml, fixDefinitionListStructure } = require('../postprocessing/definition-list-postprocessor.js');
const { getGithubRepoInfo } = require('../../utils/git-info.js');
const { templateTags } = require('../../utils/regex-patterns.js');

const { createScriptElementWithXTrefDataForEmbeddingInHtml, applyReplacers } = require('./render-utils.js');

async function render(spec, assets, sharedVars, config, template, assetsGlobal, Logger, md, externalSpecsList) {
  let { externalReferences } = sharedVars;

  try {
    global.noticeTitles = {};
    global.specGroups = {};
    Logger.info('Rendering: ' + spec.title);

    function interpolate(template, variables) {
      return template.replace(templateTags.variableInterpolation, (match, p1) => variables[p1.trim()]);
    }

    // Add current date in 'DD Month YYYY' format for template injection
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const currentDate = `${day} ${month} ${year}`;

    // Add universal timestamp in ISO 8601 format for template injection
    const universalTimestamp = date.toISOString();

    // Read all markdown files into an array
    const docs = await Promise.all(
      (spec.markdown_paths || ['spec.md']).map(_path =>
        fs.readFile(spec.spec_directory + _path, 'utf8')
      )
    );

    const features = (({ source, logo }) => ({ source, logo }))(spec);
    if (spec.external_specs && !externalReferences) {
      // Fetch xref terms and merge them into allXTrefs instead of creating DOM HTML
      const xrefTerms = await fetchExternalSpecs(spec);

      // Define paths for the xtrefs data files
      const outputPathJSON = path.join('.cache', 'xtrefs-data.json');
      const outputPathJS = path.join('.cache', 'xtrefs-data.js');

      // Merge xref terms into the unified allXTrefs structure
      await mergeXrefTermsIntoAllXTrefs(xrefTerms, outputPathJSON, outputPathJS);

      // Set flag to indicate external references have been processed
      externalReferences = true; // Changed from HTML array to boolean flag
    }

    // Find the index of the terms-and-definitions-intro.md file
    const termsIndex = (spec.markdown_paths || ['spec.md']).indexOf('terms-and-definitions-intro.md');
    if (termsIndex !== -1) {
      // Append the HTML string to the content of terms-and-definitions-intro.md. This string is used to create a div that is used to insert an alphabet index, and a div that is used as the starting point of the terminology index. The newlines are essential for the correct rendering of the markdown.
      docs[termsIndex] += '\n\n<div id="terminology-section-start"></div>\n\n';
    }

    // Set up file tracking for definitions before rendering
    for (let i = 0; i < docs.length; i++) {
      global.currentFile = spec.markdown_paths[i] || 'unknown';
      docs[i] = `<!-- file: ${global.currentFile} -->\n${docs[i]}`;
    }

    // Concatenate all file contents into one string, separated by newlines
    let doc = docs.join("\n");

    // Handles backslash escape mechanism for substitution tags
    // Phase 1: Pre-processing - Handle escaped tags
    doc = processEscapedTags(doc);

    // Handles backslash escape mechanism for substitution tags
    // Phase 2: Tag Processing - Apply normal substitution logic
    doc = applyReplacers(doc);

    md[spec.katex ? "enable" : "disable"](['math_block', 'math_inline']);

    // `render` is the rendered HTML
    let renderedHtml = md.render(doc);

    // Apply the fix for broken definition list structures
    renderedHtml = fixDefinitionListStructure(renderedHtml);

    // Sort definition terms case-insensitively before final rendering
    renderedHtml = sortDefinitionTermsInHtml(renderedHtml);

    // Handles backslash escape mechanism for substitution tags
    // Phase 3: Post-processing - Restore escaped sequences as literals
    renderedHtml = restoreEscapedTags(renderedHtml);

    // External references are now stored in allXTrefs instead of DOM HTML
    // No longer need to inject external references HTML into the template

    const templateInterpolated = interpolate(template, {
      title: spec.title,
      description: spec.description,
      author: spec.author,
      toc: global.toc,
      render: renderedHtml,
      assetsHead: assets.head,
      assetsBody: assets.body,
      assetsSvg: assets.svg,
      features: Object.keys(features).join(' '),
      externalReferences: '', // No longer inject DOM HTML - xrefs are in allXTrefs
      xtrefsData: createScriptElementWithXTrefDataForEmbeddingInHtml(),
      specLogo: spec.logo,
      specFavicon: spec.favicon,
      specLogoLink: spec.logo_link,
      spec: JSON.stringify(spec),
      externalSpecsList: externalSpecsList,
      currentDate: currentDate,
      universalTimestamp: universalTimestamp,
      githubRepoInfo: getGithubRepoInfo(spec)
    });

    const outputPath = path.join(spec.destination, 'index.html');
    Logger.info('Attempting to write to:', outputPath);

    // Use promisified version instead of callback
    await fs.promises.writeFile(outputPath, templateInterpolated, 'utf8');
    Logger.success(`Successfully wrote ${outputPath}`);

    validateReferences(global.references, global.definitions, renderedHtml);
    global.references = [];
    global.definitions = [];
  } catch (e) {
    Logger.error("Render error: " + e.message);
    throw e;
  }

  // Update sharedVars
  sharedVars.externalReferences = externalReferences;
}

module.exports = { render };
