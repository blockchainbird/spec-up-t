const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const Logger = require('../utils/logger');

/**
 * Check if a given URL has correct GitHub Pages structure
 * @param {string} urlStr - URL to check
 * @returns {boolean} - Whether the URL has correct GitHub Pages structure
 */
function isValidGitHubPagesUrl(urlStr) {
  try {
    const parsedUrl = new URL(urlStr);
    // GitHub Pages URLs are either username.github.io or github.io/repo-name
    return (
      parsedUrl.hostname === 'github.io' ||
      parsedUrl.hostname.endsWith('.github.io')
    );
  } catch (error) {
    Logger.error(`Error validating GitHub Pages URL: ${error.message}`);
    return false;
  }
}

/**
 * Check if a given URL has correct GitHub repo structure
 * @param {string} urlStr - URL to check
 * @returns {boolean} - Whether the URL has correct GitHub repo structure
 */
function isValidGitHubRepoUrl(urlStr) {
  try {
    const parsedUrl = new URL(urlStr);
    return (
      parsedUrl.hostname === 'github.com' && 
      parsedUrl.pathname.split('/').filter(Boolean).length >= 2
    );
  } catch (error) {
    Logger.error(`Error validating GitHub repo URL: ${error.message}`);
    return false;
  }
}

/**
 * Check if URL exists (returns a valid response)
 * @param {string} urlStr - URL to check
 * @returns {Promise<boolean>} - Whether the URL exists
 */
function urlExists(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(urlStr);
      const options = {
        method: 'HEAD',
        host: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch (error) {
      Logger.error(`URL Format Error: Invalid URL format for ${urlStr} - ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Check if specs.json file exists and read it
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - Object containing results and specs data if found
 */
function checkAndReadSpecsFile(projectRoot) {
  const specsPath = path.join(projectRoot, 'specs.json');
  
  if (!fs.existsSync(specsPath)) {
    return {
      results: [{
        name: 'Find specs.json file',
        success: false,
        details: 'specs.json file not found in project root'
      }],
      specs: null
    };
  }
  
  try {
    const specsContent = fs.readFileSync(specsPath, 'utf8');
    const specs = JSON.parse(specsContent);
    
    return {
      results: [{
        name: 'Find specs.json file',
        success: true,
        details: 'specs.json file found'
      }],
      specs
    };
  } catch (error) {
    return {
      results: [{
        name: 'Parse specs.json file',
        success: false,
        details: `❌ Error parsing specs.json: ${error.message}`
      }],
      specs: null
    };
  }
}

/**
 * Extract external specs from specs data
 * @param {Object} specs - Specs data
 * @returns {Object} - Object containing results and external specs if found
 */
function extractExternalSpecs(specs) {
  if (!specs.specs || !Array.isArray(specs.specs) || !specs.specs.some(spec => spec.external_specs)) {
    return {
      results: [{
        name: 'Find external_specs in specs.json',
        success: false,
        details: 'external_specs key not found in specs.json'
      }],
      externalSpecs: []
    };
  }
  
  const externalSpecs = [];
  
  specs.specs.forEach(spec => {
    if (spec.external_specs && Array.isArray(spec.external_specs)) {
      externalSpecs.push(...spec.external_specs);
    }
  });
  
  return {
    results: [{
      name: 'Find external_specs in specs.json',
      success: true,
      details: 'external_specs key found in specs.json'
    }],
    externalSpecs
  };
}

/**
 * Check GitHub Pages URL for an external spec
 * @param {Object} spec - External spec object
 * @returns {Promise<Array>} - Array of check results
 */
async function checkGitHubPagesUrl(spec) {
  const results = [];
  
  if (!spec.gh_page) {
    results.push({
      name: `Check "${spec.external_spec}" gh_page URL`,
      success: false,
      details: 'gh_page URL is missing'
    });
    return results;
  }
  
  const isValidGhPage = isValidGitHubPagesUrl(spec.gh_page);
  results.push({
    name: `Check "${spec.external_spec}" gh_page URL structure`,
    success: isValidGhPage,
    details: isValidGhPage 
      ? 'Valid GitHub Pages URL structure' 
      : `Invalid GitHub Pages URL structure: ${spec.gh_page}`
  });
  
  if (isValidGhPage) {
    const ghPageExists = await urlExists(spec.gh_page);
    results.push({
      name: `Check "${spec.external_spec}" gh_page URL exists`,
      success: ghPageExists,
      details: ghPageExists 
        ? 'GitHub Pages URL is accessible' 
        : `GitHub Pages URL is not accessible: ${spec.gh_page}`
    });
  }
  
  return results;
}

/**
 * Check repository URL for an external spec
 * @param {Object} spec - External spec object
 * @returns {Promise<Array>} - Array of check results
 */
async function checkRepositoryUrl(spec) {
  const results = [];
  
  if (!spec.url) {
    results.push({
      name: `Check "${spec.external_spec}" repo URL`,
      success: false,
      details: 'Repository URL is missing'
    });
    return results;
  }
  
  const isValidRepoUrl = isValidGitHubRepoUrl(spec.url);
  results.push({
    name: `Check "${spec.external_spec}" repo URL structure`,
    success: isValidRepoUrl,
    details: isValidRepoUrl 
      ? 'Valid GitHub repository URL structure' 
      : `Invalid GitHub repository URL structure: ${spec.url}`
  });
  
  if (isValidRepoUrl) {
    const repoUrlExists = await urlExists(spec.url);
    results.push({
      name: `Check "${spec.external_spec}" repo URL exists`,
      success: repoUrlExists,
      details: repoUrlExists 
        ? 'GitHub repository URL is accessible' 
        : `GitHub repository URL is not accessible: ${spec.url}`
    });
  }
  
  return results;
}

/**
 * Check external specs in a specs.json file
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkExternalSpecs(projectRoot) {
  try {
    // Check for and read specs.json file
    const { results, specs } = checkAndReadSpecsFile(projectRoot);
    
    if (!specs) {
      return results;
    }
    
    // Extract external specs from specs data
    const { results: extractResults, externalSpecs } = extractExternalSpecs(specs);
    
    // Combine results
    const allResults = [...results, ...extractResults];
    
    if (externalSpecs.length === 0) {
      return allResults;
    }
    
    // Check each external spec
    for (const spec of externalSpecs) {
      // Check GitHub Pages URL
      const ghPageResults = await checkGitHubPagesUrl(spec);
      allResults.push(...ghPageResults);
      
      // Check repository URL
      const repoUrlResults = await checkRepositoryUrl(spec);
      allResults.push(...repoUrlResults);
    }
    
    return allResults;
  } catch (error) {
    Logger.error('Error checking external specs:', error);
    return [{
      name: 'External specs check',
      success: false,
      details: `Error: ${error.message}`
    }];
  }
}

module.exports = {
  checkExternalSpecs
};