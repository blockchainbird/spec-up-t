const { initialize } = require('./src/init');
const Logger = require('./src/utils/logger');

module.exports = async function (options = {}) {
  try {
  const { initializeConfig } = require('./src/pipeline/configuration/prepare-spec-configuration.js');
    let toc = '';
    global.toc = '';
    const setToc = (html) => { toc = html || ''; global.toc = toc; };
    let {
      config,
      externalSpecsList,
      template,
      assets,
      externalReferences,
      references,
      definitions,
      specGroups,
      noticeTitles
    } = await initializeConfig(options);

    global.definitions = definitions;
    global.references = references;
    global.specGroups = specGroups;
    global.noticeTitles = noticeTitles;

    const fs = require('fs-extra');
    const path = require('path');
    const gulp = require('gulp');

    const {
      fetchExternalSpecs,
      validateReferences,
      findExternalSpecByKey,
      mergeXrefTermsIntoAllXTrefs
  } = require('./src/pipeline/references/external-references-service.js');

  const { processWithEscapes } = require('./src/pipeline/preprocessing/escape-processor.js');
  const { processEscapedTags, restoreEscapedTags } = require('./src/pipeline/preprocessing/escape-placeholder-utils.js');
  const { sortDefinitionTermsInHtml, fixDefinitionListStructure } = require('./src/pipeline/postprocessing/definition-list-postprocessor.js');
    const { getGithubRepoInfo } = require('./src/utils/git-info.js');

    const findPkgDir = require('find-pkg-dir');
    const modulePath = findPkgDir(__dirname);
    const { configurePlugins } = require('./src/markdown-it/plugins');
    const {
      katexRules,
      replacerRegex,
      replacerArgsRegex,
      replacers,
      createScriptElementWithXTrefDataForEmbeddingInHtml,
      lookupXrefTerm,
      applyReplacers,
      normalizePath,
      renderRefGroup,
      findKatexDist
  } = require('./src/pipeline/rendering/render-utils.js');

  const { createMarkdownParser } = require('./src/pipeline/parsing/create-markdown-parser.js');
    let md = createMarkdownParser(config, setToc);

    const xtrefsData = createScriptElementWithXTrefDataForEmbeddingInHtml();

  const { render } = require('./src/pipeline/rendering/render-spec-document.js');

    try {
      config.specs.forEach(spec => {
        spec.spec_directory = normalizePath(spec.spec_directory);
        spec.destination = normalizePath(spec.output_path || spec.spec_directory);

        if (!fs.existsSync(spec.destination)) {
          try {
            fs.mkdirSync(spec.destination, { recursive: true });
            Logger.success(`Created directory: ${spec.destination}`);
          } catch (error) {
            Logger.error(`Failed to create directory ${spec.destination}: ${error.message}`);
            throw error;
          }
        } else {
          Logger.info(`Directory already exists: ${spec.destination}`);
        }

        try {
          fs.ensureDirSync(spec.destination);
          Logger.success(`Ensured directory is ready: ${spec.destination}`);
        } catch (error) {
          Logger.error(`Failed to ensure directory ${spec.destination}: ${error.message}`);
          throw error;
        }

        let assetTags = {
          svg: fs.readFileSync(modulePath + '/assets/icons.svg', 'utf8') || ''
        };

        let customAssets = (spec.assets || []).reduce((assets, asset) => {
          let ext = asset.path.split('.').pop();
          if (ext === 'css') {
            assets.css += `<link href="${asset.path}" rel="stylesheet"/>`;
          }
          if (ext === 'js') {
            assets.js[asset.inject || 'body'] += `<script src="${asset.path}" ${asset.module ? 'type="module"' : ''} ></script>`;
          }
          return assets;
        }, {
          css: '',
          js: { head: '', body: '' }
        });

        if (options.dev) {
          assetTags.head = assets.head.css.map(_path => `<link href="${_path}" rel="stylesheet"/>`).join('') +
            customAssets.css +
            assets.head.js.map(_path => `<script src="${_path}"></script>`).join('') +
            customAssets.js.head;
          assetTags.body = assets.body.js.map(_path => `<script src="${_path}" data-manual></script>`).join('') +
            customAssets.js.body;
        }
        else {
          assetTags.head = `
          <style>${fs.readFileSync(modulePath + '/assets/compiled/head.css', 'utf8')}</style>
          ${customAssets.css}
          <script>${fs.readFileSync(modulePath + '/assets/compiled/head.js', 'utf8')}</script>
          ${customAssets.js.head}
        `;
          assetTags.body = `<script>${fs.readFileSync(modulePath + '/assets/compiled/body.js', 'utf8')}</script>
          ${customAssets.js.body}`;
        }

        if (spec.katex) {
          const katexDist = findKatexDist();
          assetTags.body += `<script>/* katex */${fs.readFileSync(path.join(katexDist, 'katex.min.js'),
            'utf8')}</script>`;
          assetTags.body += `<style>/* katex */${fs.readFileSync(path.join(katexDist, 'katex.min.css'),
            'utf8')}</style>`;

          fs.copySync(path.join(katexDist, 'fonts'), path.join(spec.destination, 'fonts'));
        }

        // Run render and wait for it
        render(spec, assetTags, { externalReferences, references, definitions, specGroups, noticeTitles }, config, template, assets, Logger, md, externalSpecsList)
          .then(() => {
            Logger.info('Render completed for:', spec.destination);
            if (options.nowatch) {
              Logger.info('Exiting with nowatch');
              process.exit(0);
            }
          })
          .catch((e) => {
            Logger.error('Render failed:', e.message);
            process.exit(1);
          });

        if (!options.nowatch) {
          gulp.watch(
            [spec.spec_directory + '**/*', '!' + path.join(spec.destination, 'index.html')],
            render.bind(null, spec, assetTags, { externalReferences, references, definitions, specGroups, noticeTitles }, config, template, assets, Logger, md, externalSpecsList)
          );
        }

      });
    } catch (error) {
      Logger.error(`Error during initialization or module execution: ${error.message}`);
      throw error; // Re-throw to let the caller handle the error
    }
  } catch (error) {
    Logger.error(`Error during initialization: ${error.message}`);
    throw error; // Re-throw to let the caller handle the error
  }
};
