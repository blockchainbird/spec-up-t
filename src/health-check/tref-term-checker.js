const fs = require('fs');
const path = require('path');
const { shouldProcessFile } = require('../utils/file-filter');
const Logger = require('../utils/logger');

/**
 * Extracts the spec name and term from a tref tag at the beginning of a markdown file
 * @param {string} firstLine - The first line of a markdown file
 * @returns {Object|null} - Object containing repo and term, or null if not found
 */
function extractTrefInfo(firstLine) {
  if (!firstLine.includes('[[tref:')) {
    return null;
  }
  
  try {
    // Extract content between [[tref: and ]]
    const trefMatch = firstLine.match(/\[\[tref:([^\]]+)\]\]/);
    if (!trefMatch?.length) {
      return null;
    }
    
    const trefContent = trefMatch[1]?.trim();
    
    // Split by the first comma
    const parts = trefContent.split(',');
    if (parts.length < 2) {
      return null;
    }
    
    // Extract repo and term
    const repo = parts[0].trim();
    const term = parts.slice(1).join(',').trim();
    
    return { repo, term };
  } catch (error) {
    Logger.error('Error extracting tref info:', error);
    return null;
  }
}

/**
 * Find all JSON cache files for repositories
 * @param {string} cacheDir - Directory containing the cached files
 * @returns {Array} - List of all JSON cache files
 */
function findAllCacheFiles(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(cacheDir)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(cacheDir, file));
    
    return files;
  } catch (error) {
    Logger.error(`Error finding cache files:`, error);
    return [];
  }
}

/**
 * Checks if a term exists in a repository JSON cache file
 * @param {string} filePath - Path to the cached repository file
 * @param {string} term - Term to search for
 * @returns {boolean} - Whether the term exists in the file
 */
function termExistsInRepo(filePath, term) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Check if the file has a terms array
    if (!cacheData?.terms?.length) {
      Logger.warn(`Cache file ${filePath} has no terms array`);
      return false;
    }
    
    // Case-insensitive search for the term
    const termLower = term.toLowerCase();
    
    // Check each term in the terms array
    for (const termObj of cacheData.terms) {
      // First check the 'term' property if it exists
      if (termObj.term?.toLowerCase() === termLower) {
        return true;
      }
      
      // If there's a definition property, check if the term appears in it
      if (termObj.definition) {
        // Look for patterns like [[def: term]] or similar
        const defMatch = termObj.definition.match(/\[\[def:\s*([^\],]+)/i);
        if (defMatch?.[1]?.trim().toLowerCase() === termLower) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    Logger.error(`Error checking if term exists in file ${filePath}:`, error);
    return false;
  }
}

/**
 * Find which repo a cache file belongs to
 * @param {string} filePath - Path to the cache file
 * @param {Array} externalSpecs - List of external specs
 * @returns {string|null} - The external_spec identifier or null
 */
function findRepoForCacheFile(filePath, externalSpecs) {
  try {
    const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!cacheData?.repository) {
      return null;
    }
    
    // Extract owner/repo from the repository field
    const repoPath = cacheData.repository;
    
    // Find matching external spec
    for (const spec of externalSpecs) {
      if (!spec.url) continue;
      
      // Extract owner/repo from the URL
      const match = spec.url.match(/github\.com\/([^/]+\/[^/]+)/i);
      if (match?.[1] && repoPath.includes(match[1])) {
        return spec.external_spec;
      }
    }
    
    return null;
  } catch (error) {
    Logger.error(`Error finding repository for cache file ${filePath}:`, error);
    return null; // Could not determine repository due to error reading or parsing cache file
  }
}

/**
 * Checks for specified term in all available external repos
 * @param {string} cacheDir - Directory containing the cached repository files
 * @param {Array} externalSpecs - List of external specs from specs.json
 * @param {string} currentRepo - The repository being checked (to exclude it)
 * @param {string} term - Term to search for
 * @returns {Array} - List of repositories where the term was found
 */
function findTermInOtherRepos(cacheDir, externalSpecs, currentRepo, term) {
  const reposWithTerm = [];
  
  // Get all cache files
  const cacheFiles = findAllCacheFiles(cacheDir);
  
  for (const cacheFile of cacheFiles) {
    // Check which repo this cache file belongs to
    const repo = findRepoForCacheFile(cacheFile, externalSpecs);
    
    // Skip if we couldn't determine which repo this is or if it's the current repo
    if (!repo || repo === currentRepo) {
      continue;
    }
    
    // Check if the term exists in this repo
    if (termExistsInRepo(cacheFile, term)) {
      reposWithTerm.push(repo);
    }
  }
  
  return reposWithTerm;
}

/**
 * Find cache file for a specific external repo
 * @param {string} cacheDir - Cache directory
 * @param {Object} specConfig - External spec configuration
 * @returns {string|null} - Path to the cache file or null
 */
function findCacheFileForRepo(cacheDir, specConfig) {
  if (!fs.existsSync(cacheDir) || !specConfig?.url) {
    return null;
  }
  
  try {
    // Extract owner and repo from URL
    const match = specConfig.url.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match?.[1] || !match?.[2]) {
      return null;
    }
    
    const owner = match[1];
    const repo = match[2];
    
    // Find all JSON files in the cache directory
    const files = fs.readdirSync(cacheDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        path: path.join(cacheDir, file),
        name: file
      }))
      // Sort by timestamp descending (assuming timestamp is at the beginning of filename)
      .sort((a, b) => {
        const timestampA = parseInt(a.name.split('-')[0] ?? '0', 10);
        const timestampB = parseInt(b.name.split('-')[0] ?? '0', 10);
        return timestampB - timestampA;
      });
    
    // Find the most recent cache file for this repo
    for (const file of files) {
      if (file.name.includes(owner) && file.name.includes(repo)) {
        return file.path;
      }
    }
    
    return null;
  } catch (error) {
    Logger.error(`Error finding cache file for repo:`, error);
    return null;
  }
}

/**
 * Get configuration and setup data from specs.json
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - Object containing results, specs data, external specs and spec directories
 */
async function getProjectConfiguration(projectRoot) {
  const results = [];
  
  // Path to the project's specs.json
  const specsPath = path.join(projectRoot, 'specs.json');
  
  // Check if specs.json exists
  if (!fs.existsSync(specsPath)) {
    return {
      results: [{
        name: 'Find specs.json file',
        success: false,
        details: 'specs.json file not found in project root'
      }],
      valid: false
    };
  }
  
  results.push({
    name: 'Find specs.json file',
    success: true,
    details: 'specs.json file found'
  });
  
  // Read specs.json to get the spec directory
  const specsContent = fs.readFileSync(specsPath, 'utf8');
  const specs = JSON.parse(specsContent);
  
  // Get the external specs
  if (!specs.specs?.length) {
    results.push({
      name: 'Find specs configuration',
      success: false,
      details: 'specs array not found in specs.json'
    });
    return { results, valid: false };
  }
  
  // Collect all external specs and spec directories
  const externalSpecs = [];
  const specDirs = [];
  
  specs.specs.forEach(spec => {
    if (spec.external_specs?.length) {
      externalSpecs.push(...spec.external_specs);
    }
    
    if (spec.spec_directory && spec.spec_terms_directory) {
      const termsDir = path.join(
        projectRoot, 
        spec.spec_directory, 
        spec.spec_terms_directory
      );
      specDirs.push(termsDir);
    }
  });

  if (externalSpecs.length === 0) {
    results.push({
      name: 'Find external specs',
      success: false,
      details: 'No external specs found in specs.json'
    });
    return { results, valid: false };
  }
  
  results.push({
    name: 'Find external specs',
    success: true,
    details: `Found ${externalSpecs.length} external specs`
  });
  
  if (specDirs.length === 0) {
    results.push({
      name: 'Find spec terms directories',
      success: false,
      details: 'No spec terms directories found'
    });
    return { results, valid: false };
  }
  
  results.push({
    name: 'Find spec terms directories', 
    success: true,
    details: `Found ${specDirs.length} spec terms directories`
  });

  return { 
    results, 
    specs, 
    externalSpecs, 
    specDirs, 
    valid: true,
    githubCacheDir: path.join(projectRoot, '.cache', 'github-cache')
  };
}

/**
 * Verify if a term exists in the specified repository
 * @param {Object} options - Options for verification
 * @param {string} options.githubCacheDir - Path to GitHub cache directory
 * @param {string} options.repo - Repository to check
 * @param {string} options.term - Term to find
 * @param {string} options.file - File name for reporting
 * @param {Array} options.externalSpecs - List of external specs
 * @returns {Object} - Object containing results and status
 */
function verifyTermInRepo(options) {
  const { githubCacheDir, repo, term, file, externalSpecs } = options;
  const results = [];

  // Check if the referenced repo exists in external_specs
  const specConfig = externalSpecs.find(spec => spec.external_spec === repo);
  if (!specConfig) {
    results.push({
      name: `Check repo reference in ${file}`,
      success: false,
      details: `Referenced repo "${repo}" is not defined in external_specs`
    });
    return { results, status: 'invalid_repo' };
  }
  
  // Find the cache file for this repo
  const cacheFile = findCacheFileForRepo(githubCacheDir, specConfig);
  
  if (!cacheFile) {
    results.push({
      name: `Find cache for repo "${repo}" referenced in ${file}`,
      success: false,
      details: `No cache file found for repo "${repo}". Unable to verify if term "${term}" exists.`
    });
    return { results, status: 'no_cache' };
  }
  
  // Check if the term exists in the repo
  const termExists = termExistsInRepo(cacheFile, term);
  
  if (termExists) {
    results.push({
      name: `Term "${term}" in repo "${repo}" (${file})`,
      success: true,
      details: `Term "${term}" found in repo "${repo}"`
    });
    return { results, status: 'found' };
  }
  
  // Check if the term exists in other repos
  const otherRepos = findTermInOtherRepos(githubCacheDir, externalSpecs, repo, term);
  
  if (otherRepos.length > 0) {
    // Show as warning (partial success) instead of failure
    results.push({
      name: `Term "${term}" in repo "${repo}" (${file})`,
      success: 'partial', // Use 'partial' to indicate a warning
      details: `Warning: Term <code>${term}</code> NOT found in repo ${repo} but found in these repos: <code>${otherRepos.join(', ')}</code>. Consider updating the reference.`
    });
    return { results, status: 'found_elsewhere' };
  }
  
  results.push({
    name: `Term "${term}" in repo "${repo}" (${file})`,
    success: false,
    details: `Term <code>${term}</code> NOT found in repo <code>${repo}</code> and not found in any other external repos`
  });
  return { results, status: 'not_found' };
}

/**
 * Process a single markdown file to check for tref tags
 * @param {Object} options - Processing options
 * @param {string} options.filePath - Path to markdown file
 * @param {string} options.githubCacheDir - Path to GitHub cache directory
 * @param {Array} options.externalSpecs - List of external specs
 * @returns {Object} - Object containing results and counts
 */
function processMarkdownFile(options) {
  const { filePath, githubCacheDir, externalSpecs } = options;
  const file = path.basename(filePath);
  const results = [];
  const counts = { 
    filesWithTref: 0, 
    validTerms: 0, 
    invalidTerms: 0, 
    termsFoundInOtherRepos: 0 
  };
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const firstLine = lines[0];
    
    if (!firstLine.includes('[[tref:')) {
      return { results, counts };
    }
    
    counts.filesWithTref = 1;
    
    // Extract repo and term information
    const trefInfo = extractTrefInfo(firstLine);
    if (!trefInfo) {
      results.push({
        name: `Parse tref in ${file}`,
        success: false,
        details: `Could not parse tref information from first line: "${firstLine}"`
      });
      return { results, counts };
    }
    
    const { repo, term } = trefInfo;
    
    // Verify the term
    const verification = verifyTermInRepo({
      githubCacheDir,
      repo,
      term,
      file,
      externalSpecs
    });
    
    results.push(...verification.results);
    
    // Update counts based on verification status
    if (verification.status === 'found') {
      counts.validTerms = 1;
    } else if (verification.status === 'found_elsewhere') {
      counts.termsFoundInOtherRepos = 1;
    } else if (verification.status === 'not_found') {
      counts.invalidTerms = 1;
    }
    
  } catch (error) {
    results.push({
      name: `Process file ${file}`,
      success: false,
      details: `Error processing file: ${error.message}`
    });
  }
  
  return { results, counts };
}

/**
 * Check if terms referenced via tref tags exist in the corresponding external repos
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkTrefTerms(projectRoot) {
  try {
    // Get project configuration
    const config = await getProjectConfiguration(projectRoot);
    
    // If configuration is invalid, return early with errors
    if (!config.valid) {
      return config.results;
    }
    
    const { results, specDirs, externalSpecs, githubCacheDir } = config;
    
    // Initialize counters
    let totalFiles = 0;
    let filesWithTref = 0;
    let validTerms = 0;
    let invalidTerms = 0;
    let termsFoundInOtherRepos = 0;
    
    // Process each spec directory
    for (const specDir of specDirs) {
      if (!fs.existsSync(specDir)) {
        continue;
      }
      
      // Get all markdown files
      const allFiles = fs.readdirSync(specDir);
      const markdownFiles = allFiles.filter(file => shouldProcessFile(file));
      
      totalFiles += markdownFiles.length;
      
      // Process each markdown file
      for (const file of markdownFiles) {
        const filePath = path.join(specDir, file);
        const fileResult = processMarkdownFile({
          filePath,
          githubCacheDir,
          externalSpecs
        });
        
        // Add results
        results.push(...fileResult.results);
        
        // Update counters
        filesWithTref += fileResult.counts.filesWithTref;
        validTerms += fileResult.counts.validTerms;
        invalidTerms += fileResult.counts.invalidTerms;
        termsFoundInOtherRepos += fileResult.counts.termsFoundInOtherRepos;
      }
    }
    
    // Add summary results
    results.push({
      name: 'Term reference validation summary',
      success: invalidTerms === 0,
      details: `Processed ${totalFiles} files, found ${filesWithTref} with tref tags. ${validTerms} terms found correctly, ${termsFoundInOtherRepos} terms found in alternative repos (warnings), ${invalidTerms} terms missing.`
    });
    
    return results;
  } catch (error) {
    Logger.error('Error checking tref terms:', error);
    return [{
      name: 'Term reference validation check',
      success: false,
      details: `Error: ${error.message}`
    }];
  }
}

module.exports = {
  checkTrefTerms
};