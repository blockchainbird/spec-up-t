/**
 * @file Orchestrates external reference collection and enrichment within the pipeline.
 *
 * This module coordinates three stages:
 * 1. Scan local markdown for `[[xref:...]]` / `[[tref:...]]` references.
 * 2. Enrich references with metadata derived from `specs.json`.
 * 3. Persist the combined dataset for downstream consumers.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const readlineSync = require('readline-sync');

const Logger = require('../../utils/logger');
const { shouldProcessFile } = require('../../utils/file-filter');
const { getCurrentBranch } = require('../../utils/git-info');
const { addNewXTrefsFromMarkdown, isXTrefInAnyFile } = require('./xtref-utils');
const { processXTrefObject } = require('../../parsers/template-tag-parser');

/**
 * Reuses the main rendering entry point once reference collection has refreshed the cache.
 * Keeping this invocation on the Node side (instead of the menu script) guarantees that
 * automated callers of `collectExternalReferences` continue to receive a fully rendered spec.
 */
function renderSpecification() {
    require('../../../index.js')({ nowatch: true });
}

/**
 * Normalizes the specs structure pulled from specs.json so callers can rely on predictable shapes.
 *
 * The helper guarantees:
 * - the returned `specs` array is always an array;
 * - callers get the first spec entry (or an empty object) as `primarySpec`;
 * - callers receive a safe `externalSpecsRepos` array for follow-up validation or iteration;
 * - when the specs array is empty, an explanatory error is logged and `null` is returned to signal abortion.
 *
 * @param {object} config - Parsed specs configuration.
 * @param {{ noSpecsMessage: string }} options - Allows callers to tailor the abort message for their context.
 * @returns {{ specs: Array<object>, primarySpec: object, externalSpecsRepos: Array<object>, hasExternalSpecsField: boolean } | null}
 */
function normalizeSpecConfiguration(config, { noSpecsMessage }) {
    const specs = Array.isArray(config?.specs) ? config.specs : [];

    if (specs.length === 0) {
        Logger.error(noSpecsMessage);
        return null;
    }

    const primarySpec = specs[0] ?? {};
    const hasExternalSpecsField = Array.isArray(primarySpec.external_specs);
    const externalSpecsRepos = hasExternalSpecsField ? primarySpec.external_specs : [];

    return { specs, primarySpec, externalSpecsRepos, hasExternalSpecsField };
}

/**
 * Augments reference records with repository metadata pulled from `specs.json`.
 *
 * @param {object} config - Parsed specs configuration.
 * @param {Array<object>} xtrefs - Reference entries collected from markdown.
 */
function extendXTrefs(config, xtrefs) {
    if (config.specs[0].external_specs_repos) {
        Logger.warn('Your specs.json file uses an outdated structure. Update it using: https://github.com/trustoverip/spec-up-t/blob/master/src/install-from-boilerplate/boilerplate/specs.json');
        return;
    }

    const repoLookup = new Map();
    const siteLookup = new Map();

    config.specs.forEach(spec => {
        spec.external_specs.forEach(repo => {
            if (repo.external_spec) {
                repoLookup.set(repo.external_spec, repo);
            }
        });

        spec.external_specs
            .filter(externalSpec => typeof externalSpec === 'object' && externalSpec !== null)
            .forEach(externalSpec => {
                const key = Object.keys(externalSpec)[0];
                siteLookup.set(key, externalSpec[key]);
            });
    });

    xtrefs.forEach(xtref => {
        xtref.repoUrl = null;
        xtref.terms_dir = null;
        xtref.owner = null;
        xtref.repo = null;
        xtref.site = null;
        xtref.branch = null;

        const repo = repoLookup.get(xtref.externalSpec);
        if (repo) {
            xtref.repoUrl = repo.url;
            xtref.terms_dir = repo.terms_dir;

            if (xtref.repoUrl) {
                const urlParts = new URL(xtref.repoUrl).pathname.split('/');
                xtref.owner = urlParts[1];
                xtref.repo = urlParts[2];
            }

            xtref.avatarUrl = repo.avatar_url;
            xtref.ghPageUrl = repo.gh_page;
        }

        const site = siteLookup.get(xtref.externalSpec);
        if (site) {
            xtref.site = site;
        }

        try {
            xtref.branch = getCurrentBranch();
        } catch (error) {
            Logger.warn(`Could not get current branch for xtref ${xtref.externalSpec}:${xtref.term}: ${error.message}`);
            xtref.branch = 'main';
        }
    });
}

/**
 * Executes the full collection pipeline once pre-flight checks pass.
 *
 * @param {object} config - Parsed specs configuration.
 * @param {string} GITHUB_API_TOKEN - GitHub PAT used for API calls.
 */
function processExternalReferences(config, GITHUB_API_TOKEN) {
    const { processXTrefsData } = require('./process-xtrefs-data');
    const { doesUrlExist } = require('../../utils/does-url-exist');

    const normalizedConfig = normalizeSpecConfiguration(config, {
        noSpecsMessage: 'No specs defined in specs.json. Skipping external reference collection.'
    });

    // Abort collection when the configuration is missing mandatory specs definitions.
    if (!normalizedConfig) {
        return;
    }

    const { specs, externalSpecsRepos } = normalizedConfig;

    externalSpecsRepos.forEach(repo => {
        doesUrlExist(repo.url)
            .then(exists => {
                if (exists) {
                    return;
                }

                const userInput = readlineSync.question(
`❌ This external reference is not a valid URL:

   Repository: ${repo.url},
   
   Terms directory: ${repo.terms_dir}

   Please fix the external references in the specs.json file that you will find at the root of your project.

   Do you want to stop? (yes/no): `);

                if (userInput.toLowerCase() === 'yes' || userInput.toLowerCase() === 'y') {
                    Logger.info('Stopping...');
                    process.exit(1);
                }
            })
            .catch(error => {
                Logger.error('Error checking URL existence:', error);
            });
    });

    const outputDir = '.cache';
    const xtrefsHistoryDir = path.join(outputDir, 'xtrefs-history');
    const outputPathJSON = path.join(outputDir, 'xtrefs-data.json');
    const outputPathJS = path.join(outputDir, 'xtrefs-data.js');
    const outputPathJSTimeStamped = path.join(xtrefsHistoryDir, `xtrefs-data-${Date.now()}.js`);

    fs.ensureDirSync(outputDir);
    fs.ensureDirSync(xtrefsHistoryDir);

    let allXTrefs = { xtrefs: [] };
    if (fs.existsSync(outputPathJSON)) {
        const existingXTrefs = fs.readJsonSync(outputPathJSON);
        if (existingXTrefs?.xtrefs) {
            allXTrefs = existingXTrefs;
        }
    }

    const specTermsDirectories = specs.reduce((directories, spec) => {
        const specDir = spec?.spec_directory;
        const termsDir = spec?.spec_terms_directory;

        if (!specDir || !termsDir) {
            Logger.warn(`Spec entry is missing spec_directory or spec_terms_directory: ${JSON.stringify(spec)}`);
            return directories;
        }

        const resolvedDir = path.join(specDir, termsDir);

        if (!fs.existsSync(resolvedDir)) {
            Logger.warn(`Spec terms directory does not exist: ${resolvedDir}`);
            return directories;
        }

        directories.push(resolvedDir);
        return directories;
    }, []);

    if (specTermsDirectories.length === 0) {
        Logger.warn('No spec terms directories found. Skipping external reference collection.');
        return;
    }

    const fileContents = new Map();

    specTermsDirectories.forEach(specDirectory => {
        fs.readdirSync(specDirectory).forEach(file => {
            if (!shouldProcessFile(file)) {
                return;
            }

            const filePath = path.join(specDirectory, file);
            const markdown = fs.readFileSync(filePath, 'utf8');
            fileContents.set(file, markdown);
        });
    });

    allXTrefs.xtrefs = allXTrefs.xtrefs.filter(existingXTref =>
        isXTrefInAnyFile(existingXTref, fileContents)
    );

    fileContents.forEach((content, filename) => {
        addNewXTrefsFromMarkdown(content, allXTrefs, filename, processXTrefObject);
    });

    extendXTrefs(config, allXTrefs.xtrefs);
    return processXTrefsData(allXTrefs, GITHUB_API_TOKEN, outputPathJSON, outputPathJS, outputPathJSTimeStamped);
}

/**
 * Public entry point for the external reference collection stage.
 *
 * @param {{ pat?: string }} options - Optional overrides (GitHub PAT).
 */
function collectExternalReferences(options = {}) {
    const config = fs.readJsonSync('specs.json');
    const normalizedConfig = normalizeSpecConfiguration(config, {
        noSpecsMessage: 'No specs defined in specs.json. Nothing to collect.'
    });

    // Bail out immediately if the specs.json file lacks the required specs collection.
    if (!normalizedConfig) {
        return;
    }

    const { externalSpecsRepos, hasExternalSpecsField } = normalizedConfig;
    const GITHUB_API_TOKEN = options.pat || process.env.GITHUB_API_TOKEN;

    if (!GITHUB_API_TOKEN) {
        Logger.warn('No GitHub Personal Access Token (PAT) found. Running without authentication (may hit rate limits).');
        Logger.info('For better performance, set up a PAT: https://trustoverip.github.io/spec-up-t-website/docs/getting-started/github-token\n');
    }

    // Communicate that the expected external_specs array is missing entirely.
    if (!hasExternalSpecsField) {
        Logger.info(
            'No external_specs array found on the first spec entry in specs.json. External reference collection is skipped.'
        );
        renderSpecification();
        return;
    }

    // Let the user know the array exists but contains no repositories, making collection pointless.
    if (externalSpecsRepos.length === 0) {
        Logger.info(
            'The external_specs array in specs.json is empty. Add external repositories to collect external references.'
        );
        renderSpecification();
        return;
    }

    const pipeline = processExternalReferences(config, GITHUB_API_TOKEN);

    // If the pipeline short-circuited (e.g. missing configuration), render immediately and return its value.
    if (pipeline && typeof pipeline.then === 'function') {
        return pipeline
            .then(result => {
                renderSpecification();
                return result;
            })
            .catch(error => {
                Logger.error('Rendering failed after collecting external references.', error);
                throw error;
            });
    } else {
        renderSpecification();
        return pipeline;
    }
}

module.exports = {
    collectExternalReferences,
    extendXTrefs,
    processExternalReferences
};
