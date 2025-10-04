/**
 * @file fetch-terms-from-index.js
 * @description Fetches term definitions from an external specification repository using either the published GitHub Pages site or the raw repository fallback.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const { getPath } = require('../../../config/paths');
const Logger = require('../../utils/logger');

const CACHE_DIR = getPath('githubcache');

async function getFileCommitHash(token, owner, repo, filePath, headers) {
    try {
        const normalizedPath = filePath.replace(/^\//, '');
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${normalizedPath}&per_page=1`;
        Logger.process(`Fetching latest commit for file: ${commitsUrl}`);

        const response = await axios.get(commitsUrl, { headers });
        if (response.status !== 200 || !Array.isArray(response.data) || response.data.length === 0) {
            Logger.error(`Could not find commit information for ${filePath}`);
            return null;
        }

        return response.data[0].sha;
    } catch (error) {
        Logger.error(`Error fetching commit hash: ${error.message}`);
        return null;
    }
}

async function fetchAllTermsFromIndex(token, owner, repo, options = {}) {
    try {
        const headers = token ? { Authorization: `token ${token}` } : {};
        let indexHtmlUrl;
        let commitHash = null;

        if (options.ghPageUrl) {
            indexHtmlUrl = options.ghPageUrl.endsWith('/')
                ? `${options.ghPageUrl}index.html`
                : `${options.ghPageUrl}/index.html`;
            Logger.process(`Fetching index.html from GitHub Pages: ${indexHtmlUrl}`);

            try {
                const mainBranchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/main`;
                const branchResponse = await axios.get(mainBranchUrl, { headers });
                if (branchResponse.status === 200) {
                    commitHash = branchResponse.data.commit.sha;
                    Logger.success(`Got commit hash from main branch: ${commitHash}`);
                }
            } catch (error) {
                Logger.warn(`Could not get commit hash from main branch: ${error.message}`);
            }
        } else {
            Logger.warn('No GitHub Pages URL provided, falling back to repository method');
            const specsJsonUrl = `https://api.github.com/repos/${owner}/${repo}/contents/specs.json`;
            Logger.process(`Fetching specs.json from: ${specsJsonUrl}`);

            const specsJsonResponse = await axios.get(specsJsonUrl, { headers });
            if (specsJsonResponse.status !== 200) {
                Logger.error(`Could not find specs.json in repository ${owner}/${repo}`);
                return null;
            }

            const specsJsonContent = Buffer.from(specsJsonResponse.data.content, 'base64').toString('utf8');
            const specsJson = JSON.parse(specsJsonContent);
            const outputPath = specsJson.specs?.[0]?.output_path;
            if (!outputPath) {
                Logger.error(`No output_path found in specs.json for repository ${owner}/${repo}`);
                return null;
            }

            const normalizedOutputPath = outputPath.replace(/^\.\//, '').replace(/\/$/, '');
            const indexHtmlPath = `${normalizedOutputPath}/index.html`;
            indexHtmlUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${indexHtmlPath}`;
            Logger.process(`Fetching index.html from raw repository: ${indexHtmlUrl}`);

            commitHash = await getFileCommitHash(token, owner, repo, indexHtmlPath, headers);
            if (!commitHash) {
                Logger.warn('Could not get commit hash for index.html, continuing without it');
            }
        }

        const indexHtmlResponse = await axios.get(indexHtmlUrl, { headers });
        if (indexHtmlResponse.status !== 200) {
            Logger.error(`Could not find index.html at ${indexHtmlUrl}`);
            return null;
        }

        const dom = new JSDOM(indexHtmlResponse.data);
        const document = dom.window.document;
        const termDlList = document.querySelector('dl.terms-and-definitions-list');
        if (!termDlList) {
            Logger.error(`No terms-and-definitions-list found in ${indexHtmlUrl}`);
            return null;
        }

        const terms = [];
        const dtElements = termDlList.querySelectorAll('dt');
        dtElements.forEach(dt => {
            const termSpan = dt.querySelector('span[id^="term:"]');
            if (!termSpan) {
                return;
            }

            let termText = '';
            termSpan.childNodes.forEach(node => {
                if (node.nodeType === dom.window.Node.TEXT_NODE) {
                    termText += node.textContent.trim();
                }
            });

            if (!termText) {
                termText = termSpan.textContent.trim();
            }

            if (!termText) {
                return;
            }

            const definitions = [];
            let pointer = dt.nextElementSibling;
            while (pointer && pointer.tagName.toLowerCase() === 'dd') {
                definitions.push(pointer.outerHTML);
                pointer = pointer.nextElementSibling;
            }

            terms.push({ term: termText, definition: definitions.join('\n') });
        });

        const timestamp = Date.now();
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        const outputFileName = `${timestamp}-${owner}-${repo}-terms.json`;
        const outputFilePath = path.join(CACHE_DIR, outputFileName);

        const result = {
            timestamp,
            repository: `${owner}/${repo}`,
            terms,
            sha: commitHash,
            avatarUrl: null,
            outputFileName
        };

        fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
        Logger.success(`Saved ${terms.length} terms to ${outputFilePath}`);

        return result;
    } catch (error) {
        if (error.response) {
            if (error.response.status === 404) {
                Logger.error(`Resource not found: ${error.config.url}`);
            } else if (error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                const resetTime = new Date(Number(error.response.headers['x-ratelimit-reset']) * 1000);
                Logger.error(`GitHub API rate limit exceeded. Try again after ${resetTime.toLocaleString()}`);
            } else {
                Logger.error(`Error fetching data: ${error.response.status} ${error.response.statusText}`);
            }
        } else {
            Logger.error(`Error fetching term: ${error.message}`);
        }
        return null;
    }
}

async function fetchTermsFromIndex(token, term, owner, repo, termsDir, options = {}) {
    const allTermsData = await fetchAllTermsFromIndex(token, owner, repo, options);
    if (!allTermsData || !Array.isArray(allTermsData.terms)) {
        return null;
    }

    const foundTerm = allTermsData.terms.find(t => t.term.toLowerCase() === term.toLowerCase());
    if (!foundTerm) {
        Logger.error(`Term "${term}" not found in repository ${owner}/${repo}`);
        return null;
    }

    Logger.success(`Found term '${term}' in repository ${owner}/${repo}`);
    return {
        term: foundTerm.term,
        content: foundTerm.definition,
        sha: allTermsData.sha,
        repository: {
            owner: {
                login: owner,
                avatar_url: allTermsData.avatarUrl
            },
            name: repo
        }
    };
}

module.exports = {
    fetchTermsFromIndex,
    fetchAllTermsFromIndex
};
