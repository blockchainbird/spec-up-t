/**
 * @file Collects and processes external reference information for cross-specification linking.
 * 
 * This script fetches the latest commit hash of term files from GitHub repositories
 * configured in specs.json, then generates both JavaScript and JSON files containing
 * cross-reference (xref/tref) data for use in specifications.
 * 
 * Example of the output:
 * 
 * const allXTrefs = {
    "xtrefs": [
        {
        "externalSpec": "toip1",
        "term": "SSI",
        "repoUrl": "https://github.com/henkvancann/ctwg-main-glossary",
        "terms_dir": "spec/terms-definitions",
        "owner": "henkvancann",
        "repo": "ctwg-main-glossary",
        "site": null,
        "commitHash": "not found",
        "content": "This term was not found in the external repository."
        },
        {
        "externalSpec": "vlei1",
        "term": "vlei-ecosystem-governance-framework",
        "repoUrl": "https://github.com/henkvancann/vlei-glossary",
        "terms_dir": "spec/terms-definitions",
        "owner": "henkvancann",
        "repo": "vlei-glossary",
        "avatarUrl": "https://avatars.githubusercontent.com/u/479356?v=4",
        "site": null,
        "commitHash": "5e36b16e58984eeaccae22116a2bf058ab01a0e9",
        "content": "[[def: vlei-ecosystem-governance-framework, vlei ecosystem governance framework]]\n\n~ The Verifiable LEI (vLEI) Ecosystem [[ref: governance-framework]] Information Trust Policies. It's a **document** that defines the … etc"
        }
    ]
  };
 * 
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-06-09
 */

require('dotenv').config();
const { shouldProcessFile } = require('./utils/file-filter');
const path = require('path');
const fs = require('fs-extra');
const readlineSync = require('readline-sync');

/**
 * Checks if a specific xtref is present in the markdown content
 * 
 * @param {Object} xtref - The xtref object to check for
 * @param {string} markdownContent - The markdown content to search in
 * @returns {boolean} True if the xtref is found in the content
 */
function isXTrefInMarkdown(xtref, markdownContent) {
    // Escape special regex characters in externalSpec and term
    const escapedSpec = xtref.externalSpec.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    const escapedTerm = xtref.term.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    
    // Check for both the term and with any alias (accounting for spaces)
    const regexTerm = new RegExp(`\\[\\[(?:x|t)ref:\\s*${escapedSpec},\\s*${escapedTerm}(?:,\\s*[^\\]]+)?\\]\\]`, 'g');
    return regexTerm.test(markdownContent);
}

/**
 * Helper function to process an XTref string and return an object.
 * 
 * @param {string} xtref - The xtref string to process
 * @returns {Object} An object with externalSpec, term, and optional alias properties
 */
function processXTref(xtref) {
    const parts = xtref
        .replace(/\[\[(?:xref|tref):/, '')
        .replace(/\]\]/, '')
        .trim()
        .split(/,/);
    
    const xtrefObject = {
        externalSpec: parts[0].trim(),
        term: parts[1].trim()
    };
    
    // Add alias if provided (third parameter)
    if (parts.length > 2 && parts[2].trim()) {
        xtrefObject.alias = parts[2].trim();
    }

    return xtrefObject;
}

/**
 * Adds new xtrefs found in markdown content to the existing collection
 * 
 * @param {string} allMarkdownContent - The content to search for XTrefs
 * @param {Object} allXTrefs - An object with an array property "xtrefs" to which new entries will be added
 * @returns {Object} The updated allXTrefs object
 */
function addNewXTrefsFromMarkdown(allMarkdownContent, allXTrefs) {
    const regex = /\[\[(?:xref|tref):.*?\]\]/g;
    if (regex.test(allMarkdownContent)) {
        const xtrefs = allMarkdownContent.match(regex);
        xtrefs.forEach(xtref => {
            const newXTrefObj = processXTref(xtref);
            if (!allXTrefs?.xtrefs?.some(existingXTref =>
                existingXTref.term === newXTrefObj.term &&
                existingXTref.externalSpec === newXTrefObj.externalSpec)) {
                allXTrefs.xtrefs.push(newXTrefObj);
            }
        });
    }
    return allXTrefs;
}

/**
 * Extends xtref objects with additional information like repository URL and directory information
 * 
 * @param {Object} config - The configuration object from specs.json
 * @param {Array} xtrefs - Array of xtref objects to extend
 */
function extendXTrefs(config, xtrefs) {
    if (config.specs[0].external_specs_repos) {
        console.log("ℹ️ PLEASE NOTE: Your specs.json file is outdated (not your fault, we changed something). Use this one: https://github.com/trustoverip/spec-up-t/blob/master/src/install-from-boilerplate/boilerplate/specs.json");
        return;
    }

    xtrefs.forEach(xtref => {
        config.specs.forEach(spec => {
            // Loop through "external_specs" to find the repository URL for each xtref
            xtref.repoUrl = null;
            xtref.terms_dir = null;
            xtref.owner = null;
            xtref.repo = null;

            spec.external_specs.forEach(repo => {
                if (repo.external_spec === xtref.externalSpec) {
                    xtref.repoUrl = repo.url;
                    xtref.terms_dir = repo.terms_dir;
                    const urlParts = new URL(xtref.repoUrl).pathname.split('/');
                    xtref.owner = urlParts[1];
                    xtref.repo = urlParts[2];
                    xtref.avatarUrl = repo.avatar_url;
                }
            });

            // Loop through "external_specs" to find the site URL for each xtref
            xtref.site = null;
            spec?.external_specs?.forEach(externalSpec => {
                const key = Object.keys(externalSpec)[0];
                if (key === xtref.externalSpec) {
                    xtref.site = externalSpec[key];
                }
            });
        });
    });
}

/**
 * Processes the main functionality after initial validation checks
 * 
 * @param {Object} config - The configuration object from specs.json
 * @param {string} GITHUB_API_TOKEN - The GitHub API token
 * @param {Object} options - Configuration options
 */
function processExternalReferences(config, GITHUB_API_TOKEN, options) {
    const { processXTrefsData } = require('./collectExternalReferences/processXTrefsData.js');
    const { doesUrlExist } = require('./utils/doesUrlExist.js');
    const externalSpecsRepos = config.specs[0].external_specs;

    // Check if the URLs for the external specs repositories are valid, and prompt the user to abort if they are not.
    externalSpecsRepos.forEach(repo => {
        doesUrlExist(repo.url).then(exists => {
            if (!exists) {
                const userInput = readlineSync.question(
`❌ This external reference is not a valid URL:

   Repository: ${repo.url},
   
   Terms directory: ${repo.terms_dir}

   Please fix the external references in the specs.json file that you will find at the root of your project.

   Do you want to stop? (yes/no): `);
                if (userInput.toLowerCase() === 'yes' || userInput.toLowerCase() === 'y') {
                    console.log('ℹ️ Stopping...');
                    process.exit(1);
                }
            }
        }).catch(error => {
            console.error('❌ Error checking URL existence:', error);
        });
    });

    // Collect all directories that contain files with a term and definition
    // This maps over the specs in the config file and constructs paths to directories
    // where the term definition files are located.
    const specTermsDirectories = config.specs.map(spec => 
        path.join(spec.spec_directory, spec.spec_terms_directory)
    );

    // Ensure that the 'output' directory exists, creating it if necessary.
    const outputDir = '.cache';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Ensure that the 'xtrefs-history' in outputDir exists, creating it if necessary.
    const xtrefsHistoryDir = path.join(outputDir, 'xtrefs-history');
    if (!fs.existsSync(xtrefsHistoryDir)) {
        fs.mkdirSync(xtrefsHistoryDir);
    }

    // Define paths for various output files, including JSON and JS files.
    const outputPathJSON = path.join(outputDir, 'xtrefs-data.json');
    const outputPathJS = path.join(outputDir, 'xtrefs-data.js');
    const outputPathJSTimeStamped = path.join(xtrefsHistoryDir, `xtrefs-data-${Date.now()}.js`);

    // Initialize an object to store all xtrefs.
    let allXTrefs = { xtrefs: [] };

    // If the output JSON file exists, load its data.
    if (fs.existsSync(outputPathJSON)) {
        const existingXTrefs = fs.readJsonSync(outputPathJSON);
        if (existingXTrefs?.xtrefs) {
            allXTrefs = existingXTrefs;
        }
    }

    // Collect all markdown content
    let allMarkdownContent = '';

    // Read all main repo Markdown files from a list of directories and concatenate their content into a single string.
    specTermsDirectories.forEach(specDirectory => {
        fs.readdirSync(specDirectory).forEach(file => {
            if (shouldProcessFile(file)) {
                const filePath = path.join(specDirectory, file);
                const markdown = fs.readFileSync(filePath, 'utf8');
                allMarkdownContent += markdown;
            }
        });
    });

    // Remove existing entries if not in the combined markdown content
    allXTrefs.xtrefs = allXTrefs.xtrefs.filter(existingXTref => {
        return isXTrefInMarkdown(existingXTref, allMarkdownContent);
    });

    addNewXTrefsFromMarkdown(allMarkdownContent, allXTrefs);

    // Example at this point:
    // allXTrefs.xtrefs: [
    //     { externalSpec: 'kmg-1', term: 'authentic-chained-data-container' },
    // ]

    // Extend each xref with additional data and fetch commit information from GitHub.
    extendXTrefs(config, allXTrefs.xtrefs);

    // Example at this point:
    // allXTrefs.xtrefs: [
    //     {
    //         externalSpec: 'kmg-1',
    //         term: 'authentic-chained-data-container',
    //         repoUrl: 'https://github.com/henkvancann/keri-main-glossary',
    //         terms_dir: 'spec/terms-definitions',
    //         owner: 'henkvancann',
    //         repo: 'keri-main-glossary',
    //         site: null
    //     }
    // ]
    
    processXTrefsData(allXTrefs, GITHUB_API_TOKEN, outputPathJSON, outputPathJS, outputPathJSTimeStamped, options);
}

/**
 * Collects external references from markdown files and processes them into usable data files.
 * 
 * @function collectExternalReferences
 * @param {Object} options - Configuration options
 * @param {string} [options.pat] - GitHub Personal Access Token (overrides environment variable)
 * @returns {void}
 * 
 * @description
 * This function performs several key operations:
 * 1. Optionally uses GitHub PAT for better API performance and higher rate limits
 * 2. Checks validity of repository URLs
 * 3. Extracts xref/tref patterns from markdown content
 * 4. Extends references with repository metadata
 * 5. Processes references to fetch commit information
 * 6. Generates output files in both JS and JSON formats
 * 
 * Note: The function will run without a GitHub token but may encounter rate limits.
 * For better performance, provide a GitHub Personal Access Token via environment
 * variable or the options parameter.
 * 
 * @example
 * // Basic usage
 * collectExternalReferences();
 * 
 * // With explicit PAT
 * collectExternalReferences({ pat: 'github_pat_xxxxxxxxxxxx' });
 */
function collectExternalReferences(options = {}) {
    const config = fs.readJsonSync('specs.json');
    const externalSpecsRepos = config.specs[0].external_specs;
    const GITHUB_API_TOKEN = options.pat || process.env.GITHUB_API_TOKEN;

    const explanationNoExternalReferences =
`❌ No external references were found in the specs.json file.

   There is no point in continuing without external references, so we stop here.

   Please add external references to the specs.json file that you will find at the root of your project.

`;
    
    // First do some checks
    // Show informational message if no token is available
    if (!GITHUB_API_TOKEN) {
        console.log('ℹ️ No GitHub Personal Access Token (PAT) found. Running without authentication (may hit rate limits).');
        console.log('💡 For better performance, set up a PAT: https://blockchainbird.github.io/spec-up-t-website/docs/getting-started/github-token\n');
    }

    if (externalSpecsRepos.length === 0) {
        // Check if the URLs for the external specs repositories are valid, and prompt the user to abort if they are not.
        console.log(explanationNoExternalReferences);
        const userInput = readlineSync.question('Press any key');

        // React to user pressing any key
        if (userInput.trim() !== '') {
            console.log('ℹ️ Stopping...');
            return;
        }
    } else {
        processExternalReferences(config, GITHUB_API_TOKEN, options);
    }
}

module.exports = {
    collectExternalReferences,
    isXTrefInMarkdown,
    addNewXTrefsFromMarkdown,
    processXTref
};
