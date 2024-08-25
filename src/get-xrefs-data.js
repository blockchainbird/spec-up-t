/**
 * @file This file creates a JavaScript file with the data for the xrefs. It fetches the latest commit hash of the term files from the GitHub API and stores the data in a JavaScript file that is included in the HTML output of the specification. The outputted JS file serves as a source for the JS code that will be included in the html file.
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-06-09
 */

const fs = require('fs-extra');
const config = fs.readJsonSync('specs.json');

// Collect all directories that contain files with a term and definition
const specTermsDirectories = config.specs.map(spec => spec.spec_directory + '/' + spec.spec_terms_directory);

// Create directory named “output” in the project root if it does not yet exist
if (!fs.existsSync('output')) {
    fs.mkdirSync('output');
}

// Create directory named “output/xrefs-history” in the project root if it does not yet exist
if (!fs.existsSync('output/xrefs-history')) {
    fs.mkdirSync('output/xrefs-history');
}

// Create a path for the output file in the project root
const outputPathJSON = 'output/xrefs-data.json';
const outputPathJS = 'output/xrefs-data.js';
const outputPathJSTimeStamped = 'output/xrefs-history/xrefs-data-' + Date.now() + '.js';

function getXrefsData() {
    let allXrefs = {};
    allXrefs.xrefs = new Set();

    // Function to fetch the latest commit hash of the file
    async function fetchLatestCommitHash(match) {
        try {

            if (match.repoUrl === undefined) {
                console.log('match.repoUrl is undefined');
                return;
            }

            // prerequisite: filename should be the term in the match object with spaces replaced by dashes and all lowercase
            const url = `https://api.github.com/repos/${match.owner}/${match.repo}/commits?path=${match.terms_dir}/${match.term.replace(/ /g, '-').toLowerCase()}.md`;

            // Fetch the list of commits for the specified file
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            // Check for rate limit before proceeding
            if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
                const resetTime = new Date(response.headers.get('X-RateLimit-Reset') * 1000);
                console.error(`Github API rate limit exceeded. Try again after ${resetTime}`);
                return;
            }

            // Check if the request was successful
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log(`Github API request for the term “${match.term}” was successful`);

            // Extract JSON data from the response, see https://blockchainbird.github.io/spec-up-t-website/docs/various-roles/developers-guide/#example-of-api-response for example response
            const data = await response.json();

            // Check if there are any commits
            if (data.length === 0) {
                console.log(`No commit hash found for the term “${match.term}”`);

                return;
            }

            // Process the last ten commits
            const commits = data.slice(0, 1); // Get only the last commit
            const commitHash = commits.map(commit => commit.sha);
            
            console.log(`Commit hash found for the term “${match.term}”: `, commitHash);
            return commitHash;

            // return;
        } catch (error) {
            console.error(`Failed to fetch commit hash for the term “${match.term}”:`, error);
        }
    }

    // Go through all directories that contain files with a term and definition
    console.log("All “spec_directory”'s found in specs.json: ", specTermsDirectories);
    specTermsDirectories.forEach(specDirectory => {
        console.log(`Current spec_directory: `, specDirectory);
        // read directory
        fs.readdirSync(specDirectory).forEach(file => {
            // read file
            if (file.endsWith('.md')) {
                console.log(`Markdown file referenced in spec_directory: `, file);
                const markdown = fs.readFileSync(`${specDirectory}/${file}`, 'utf8');
                // create regex that finds “[[xref:.*]]”
                const regex = /\[\[xref:.*?\]\]/g;
                if (regex.test(markdown)) {
                    const xrefs = markdown.match(regex);
                    xrefs.forEach(xref => {
                        console.log(`Xref found in ${file}: `, xref);
                        // example of xref: [xref: test-1, Aal]
                        allXrefs.xrefs.add(xref);
                    });
                }
            }
        });
    })
    // Convert the Set back to an Array if needed
    allXrefs.xrefs = Array.from(allXrefs.xrefs);

    // Example output:
    // allXrefs.xrefs: [
    //     '[[xref: test-1, Aal]]',
    //     '[[xref: test-2, Abac]]'
    // ]

    // The following steps create an array of objects with the keys “externalSpec” and “term” for each xref by splitting the xref string on the comma and removing the “[[xref:” and “]]” parts

    // remove “[[xref:” from the beginning of every value in allMatches
    allXrefs.xrefs = allXrefs.xrefs.map(xref => {
        return xref.replace(/\[\[xref:/, '');
    });
    // remove “]]” from the end of every value in allMatches
    allXrefs.xrefs = allXrefs.xrefs.map(xref => {
        return xref.replace(/\]\]/, '');
    });

    // trim every entry of allMatches
    allXrefs.xrefs = allXrefs.xrefs.map(xref => {
        return xref.trim();
    });

    // split every entry of allMatches on the first comma, replace the entry with an object that has two keys: one that contains everything before the comma and one that contains everything after the comma
    allXrefs.xrefs = allXrefs.xrefs.map(xref => {
        let [externalSpec, term] = xref.split(/,/, 2);
        return {
            externalSpec: externalSpec.trim(),
            term: term.trim()
        };
    })

    // Example output:
    // allXrefs.xrefs: [
    //     { externalSpec: 'PE', term: 'Holder' },
    //     { externalSpec: 'test-1', term: 'Aal' },
    //     { externalSpec: 'test-2', term: 'Abac' }
    // ]


    allXrefs.xrefs.forEach(xref => {
        config.specs.forEach(spec => {
            spec.external_specs_repos.forEach(repo => {
                // if the externalSpec is in the config, add the url and the dir where the terms are, to the xref object
                // Example external_specs_repos:
                // "external_specs_repos": [
                //     {
                //         "external_spec": "PE",
                //         "url": "https://github.com/decentralized-identity/presentation-exchange",
                //         "terms_dir": "spec"
                //     },
                // …
                // ]
                if (repo.external_spec === xref.externalSpec) {
                    xref.repoUrl = repo.url;
                    xref.terms_dir = repo.terms_dir;
                }
            });
        });
    });

    allXrefs.xrefs.forEach(xref => {
        if (xref.repoUrl === undefined) {
            console.log('match.repoUrl is undefined');
            return;
        }

        const urlParts = new URL(xref.repoUrl).pathname.split('/');
        xref.owner = urlParts[1];
        xref.repo = urlParts[2];
    });

    allXrefs.xrefs.forEach(xref => {
        // loop through array of specs in config
        config.specs.forEach(spec => {
            if (spec.external_specs) {
                // Example external_specs:
                // "external_specs": [
                //     {
                //         "PE": "https://identity.foundation/presentation-exchange"
                //     },
                // …
                // ]
                spec.external_specs.forEach(externalSpec => {
                    const key = Object.keys(externalSpec)[0];
                    if (key === xref.externalSpec) {
                        xref.site = externalSpec[key];
                    }
                });
            }
        });
    });

    // Loop through all xrefs and fetch the latest commit hash for each term and add it to the xref object
    /* Example of xref after adding commitHash:
        xref:  {
            "externalSpec": "test-1",
            "term": "Aal",
            "repoUrl": "https://github.com/blockchainbird/spec-up-xref-test-1",
            "terms_dir": "spec/term-definitions",
            "owner": "blockchainbird",
            "repo": "spec-up-xref-test-1",
            "site": "https://blockchainbird.github.io/spec-up-xref-test-1/",
            "commitHash": [
                "f66951f1d378490289caab9c51141b44a0438365"
            ]
        }
    */
    async function fetchLatestCommitHashes() {
        for (const xref of allXrefs.xrefs) {
            xref.commitHash = await fetchLatestCommitHash(xref);
        }
    }

    // Call the function and wait for it to complete before writing to the file
    fetchLatestCommitHashes().then(() => {
        // Convert allXrefsStr to a JSON string with indentation
        const allXrefsStr = JSON.stringify(allXrefs, null, 2);

        // // Write the JSON code to a .json file
        fs.writeFileSync(outputPathJSON, allXrefsStr, 'utf8');

        // Create the JS code for the assignment
        const stringReadyForFileWrite = `const allXrefs = ${allXrefsStr};`;

        // Write the JS code to a .js file
        fs.writeFileSync(outputPathJS, stringReadyForFileWrite, 'utf8');
        fs.writeFileSync(outputPathJSTimeStamped, stringReadyForFileWrite, 'utf8');
    });
}

module.exports = {
    getXrefsData
}