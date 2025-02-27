/**
 * @file This script is responsible for fetching the latest commit hash of term files from the GitHub API and generating both a JavaScript file and a JSON file containing the data for the cross-references (xrefs). 
 * 
 * The generated JavaScript file is included in the HTML output of the specification, serving as a data source for the JavaScript code embedded in the HTML file. 
 * 
 * Additionally, the data is written to a JSON file for further processing or usage. This ensures that the xref data is available in both JavaScript and JSON formats, providing flexibility for different use cases.
 *
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-06-09
 */


function collectExternalReferences(options = {}) {
    require('dotenv').config();
    const fs = require('fs-extra');
    const readlineSync = require('readline-sync');
    const config = fs.readJsonSync('specs.json');
    const externalSpecsRepos = config.specs[0].external_specs;
    const GITHUB_API_TOKEN = options.pat || process.env.GITHUB_API_TOKEN;

    const explanationPAT =
`❌ No GitHub Personal Access Token (PAT) was found.

   GitHub requires you to set up a PAT to retrieve external references.

   There is no point in continuing without a PAT, so we stop here.

   Find instructions on how to get a PAT at https://trustoverip.github.io/spec-up-t-website/docs/getting-started/github-token

 `;

    const explanationNoExternalReferences =
`❌ No external references were found in the specs.json file.

   There is no point in continuing without external references, so we stop here.

   Please add external references to the specs.json file that you will find at the root of your project.

`;
    
    
    // First do some checks

    // Do not run the script if the GitHub API token is not set
    if (!GITHUB_API_TOKEN) {
        console.log(explanationPAT);
        const userInput = readlineSync.question('ℹ️ Press any key');

        // React to user pressing any key
        if (userInput.trim() !== '') {
            console.log('ℹ️ Stopping...');
            return;
        }
    }

    else if (externalSpecsRepos.length === 0) {
        // Check if the URLs for the external specs repositories are valid, and prompt the user to abort if they are not.
        console.log(explanationNoExternalReferences);
        const userInput = readlineSync.question('Press any key');

        // React to user pressing any key
        if (userInput.trim() !== '') {
            console.log('ℹ️ Stopping...');
            return;
        }
    } else {
        main();
    }

    function main() {
        const { processXTrefsData } = require('./collectExternalReferences/processXTrefsData.js');
        const { doesUrlExist } = require('./utils/doesUrlExist.js');

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
        const specTermsDirectories = config.specs.map(spec => spec.spec_directory + '/' + spec.spec_terms_directory);

        // Ensure that the 'output' directory exists, creating it if necessary.
        if (!fs.existsSync('output')) {
            fs.mkdirSync('output');
        }

        // Ensure that the 'output/xtrefs-history' directory exists, creating it if necessary.
        if (!fs.existsSync('output/xtrefs-history')) {
            fs.mkdirSync('output/xtrefs-history');
        }

        // Define paths for various output files, including JSON and JS files.
        const outputPathJSON = 'output/xtrefs-data.json';
        const outputPathJS = 'output/xtrefs-data.js';
        const outputPathJSTimeStamped = 'output/xtrefs-history/xtrefs-data-' + Date.now() + '.js';

        // Function to extend xtref objects with additional information, such as repository URL and directory information.
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
                    if (spec.external_specs) {
                        spec.external_specs.forEach(externalSpec => {
                            const key = Object.keys(externalSpec)[0];
                            if (key === xtref.externalSpec) {
                                xtref.site = externalSpec[key];
                            }
                        });
                    }
                });
            });
        }

        // Function to check if an xtref is in the markdown content
        function isXTrefInMarkdown(xtref, markdownContent) {
            // const regex = new RegExp(`\\[\\[xref:${xref.term}\\]\\]`, 'g');
            const regex = new RegExp(`\\[\\[(?:x|t)ref:${xtref.term}\\]\\]`, 'g');
            const result = regex.test(markdownContent);
            return result;
        }

        // Function to process and clean up xref / tref strings found in the markdown file, returning an object with `externalSpec` and `term` properties.
        function processXTref(xtref) {
            let [externalSpec, term] = xtref.replace(/\[\[(?:xref|tref):/, '').replace(/\]\]/, '').trim().split(/,/, 2);
            return {
                externalSpec: externalSpec.trim(),
                term: term.trim()
            };
        }

        // Initialize an object to store all xtrefs.
        let allXTrefs = { xtrefs: [] };

        // If the output JSON file exists, load its data.
        if (fs.existsSync(outputPathJSON)) {
            const existingXTrefs = fs.readJsonSync(outputPathJSON);
            if (existingXTrefs && existingXTrefs.xtrefs) {
                allXTrefs = existingXTrefs;
            }
        }

        // Collect all markdown content
        let allMarkdownContent = '';

        // Read all main repo Markdown files from a list of directories and concatenate their content into a single string.
        specTermsDirectories.forEach(specDirectory => {
            fs.readdirSync(specDirectory).forEach(file => {
                if (file.endsWith('.md')) {
                    const markdown = fs.readFileSync(`${specDirectory}/${file}`, 'utf8');
                    allMarkdownContent += markdown;
                }
            });
        });

        // Remove existing entries if not in the combined markdown content
        allXTrefs.xtrefs = allXTrefs.xtrefs.filter(existingXTref => {
            return isXTrefInMarkdown(existingXTref, allMarkdownContent);
        });

        // Add new entries if they are in the markdown
        const regex = /\[\[(?:xref|tref):.*?\]\]/g;

        // `regex` is the regular expression object, and `allMarkdownContent` is the string being tested. The test method returns a boolean value: true if the pattern is found within the string, and false otherwise.
        if (regex.test(allMarkdownContent)) {
            const xtrefs = allMarkdownContent.match(regex);
            xtrefs.forEach(xtref => {
                const newXTrefObj = processXTref(xtref);
                // Ensure that newXTrefObj is only added to the xtrefs array if there isn't already an object with the same term and externalSpec properties. This helps maintain the uniqueness of entries in the array based on these two properties.
                if (!allXTrefs.xtrefs.some(existingXTref =>
                    existingXTref.term === newXTrefObj.term && existingXTref.externalSpec === newXTrefObj.externalSpec)) {
                    allXTrefs.xtrefs.push(newXTrefObj);
                }
            });
        };

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


}

module.exports = {
    collectExternalReferences
}
