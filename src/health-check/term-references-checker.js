const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');
const { externalReferences } = require('../utils/regex-patterns');

/**
 * Extracts the spec name from a tref tag at the beginning of a markdown file
 * @param {string} firstLine - The first line of a markdown file
 * @returns {string|null} - The extracted spec name or null if not found
 */
function extractSpecNameFromTref(firstLine) {
  if (!firstLine.includes('[[tref:')) {
    return null;
  }
  
  try {
    // Extract content between [[tref: and the next comma
    const match = firstLine.match(externalReferences.trefSpecExtractor);
    if (match && match[1]) {
      // Trim whitespace
      return match[1].trim();
    }
  } catch (error) {
    Logger.error('Error extracting spec name from tref:', error);
  }
  
  return null;
}

/**
 * Validates the existence of specs.json and returns its parsed content
 * @param {string} projectRoot - Root directory of the project
 * @param {Array} results - Results array to populate
 * @returns {Object|null} - Parsed specs.json or null if not found
 */
function getSpecsConfig(projectRoot, results) {
  const specsPath = path.join(projectRoot, 'specs.json');
  
  if (!fs.existsSync(specsPath)) {
    results.push({
      name: 'Find specs.json file',
      success: false,
      details: 'specs.json file not found in project root'
    });
    return null;
  }
  
  try {
    const specsContent = fs.readFileSync(specsPath, 'utf8');
    return JSON.parse(specsContent);
  } catch (error) {
    results.push({
      name: 'Parse specs.json file',
      success: false,
      details: `Error parsing specs.json: ${error.message}`
    });
    return null;
  }
}

/**
 * Extracts external specs and term directories from specs configuration
 * @param {Object} specs - Specs configuration object
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - Object containing external specs and term directories
 */
function extractSpecsInfo(specs, projectRoot) {
  const externalSpecs = [];
  const allSpecDirectories = [];
  
  if (!specs.specs || !Array.isArray(specs.specs)) {
    return { externalSpecs, allSpecDirectories };
  }
  
  specs.specs.forEach(spec => {
    // Collect external specs
    if (spec.external_specs && Array.isArray(spec.external_specs)) {
      spec.external_specs.forEach(extSpec => {
        if (extSpec.external_spec) {
          externalSpecs.push(extSpec.external_spec);
        }
      });
    }
    
    // Collect term directories
    if (spec.spec_directory && spec.spec_terms_directory) {
      const termsDir = path.join(
        projectRoot, 
        spec.spec_directory, 
        spec.spec_terms_directory
      );
      allSpecDirectories.push(termsDir);
    }
  });
  
  return { externalSpecs, allSpecDirectories };
}

/**
 * Reports status of found external specs
 * @param {Array} externalSpecs - List of external specs
 * @param {Array} results - Results array to populate
 */
function reportExternalSpecs(externalSpecs, results) {
  if (externalSpecs.length === 0) {
    results.push({
      name: 'Find external specs',
      success: false,
      details: 'No external_spec entries found in specs.json'
    });
    return false;
  }
  
  results.push({
    name: 'Find external specs',
    success: true,
    details: `Found ${externalSpecs.length} external specs: ${externalSpecs.join(', ')}`
  });
  return true;
}

/**
 * Reports status of found spec term directories
 * @param {Array} allSpecDirectories - List of spec term directories
 * @param {Array} results - Results array to populate
 * @returns {boolean} - Whether any directories were found
 */
function reportSpecDirectories(allSpecDirectories, results) {
  if (allSpecDirectories.length === 0) {
    results.push({
      name: 'Find spec terms directories',
      success: false,
      details: 'No spec_directory/spec_terms_directory entries found in specs.json'
    });
    return false;
  }
  
  results.push({
    name: 'Find spec terms directories',
    success: true,
    details: `Found ${allSpecDirectories.length} spec terms directories`
  });
  return true;
}

/**
 * Gets markdown files from a terms directory
 * @param {string} termsDir - Path to terms directory
 * @param {Array} results - Results array to populate
 * @returns {Array} - List of markdown file paths or empty array if none found
 */
function getMarkdownFiles(termsDir, results) {
  if (!fs.existsSync(termsDir)) {
    results.push({
      name: `Check terms directory: ${termsDir}`,
      success: false,
      details: `Terms directory does not exist: ${termsDir}`
    });
    return [];
  }
  
  const markdownFiles = fs.readdirSync(termsDir)
    .filter(file => path.extname(file) === '.md')
    .map(file => path.join(termsDir, file));
  
  if (markdownFiles.length === 0) {
    results.push({
      name: `Find markdown files in <code>${termsDir}</code>`,
      success: false,
      details: `No markdown files found in terms directory: ${termsDir}`
    });
    return [];
  }
  
  results.push({
    name: `Find markdown files in <code>${termsDir}</code>`,
    success: true,
    details: `Found ${markdownFiles.length} markdown files`
  });
  
  return markdownFiles;
}

/**
 * Validates a markdown file's tref references
 * @param {string} mdFile - Path to markdown file
 * @param {Array} externalSpecs - List of external specs
 * @param {Array} results - Results array to populate
 */
function validateMarkdownFile(mdFile, externalSpecs, results) {
  try {
    const content = fs.readFileSync(mdFile, 'utf8');
    const firstLine = content.split('\n')[0];
    
    if (!firstLine.includes('[[tref:')) {
      return; // Skip this file
    }
    
    const specName = extractSpecNameFromTref(firstLine);
    if (!specName) {
      results.push({
        name: `Check tref in ${path.basename(mdFile)}`,
        success: false,
        details: `Could not extract spec name from tref tag in first line: "${firstLine}"`
      });
      return;
    }
    
    const isValid = externalSpecs.includes(specName);
    results.push({
      name: `Check tref spec "${specName}" in <code>${path.basename(mdFile)}</code>`,
      success: isValid,
      details: isValid
        ? `Valid external spec reference: ${specName}`
        : `Invalid external spec reference: "${specName}" is not defined in external_specs`
    });
  } catch (error) {
    results.push({
      name: `Check file ${path.basename(mdFile)}`,
      success: false,
      details: `Error reading or processing file: ${error.message}`
    });
  }
}

/**
 * Check if all markdown files in spec terms directories have valid tref references
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkTermReferences(projectRoot) {
  const results = [];
  
  try {
    const specs = getSpecsConfig(projectRoot, results);
    if (!specs) {
      return results;
    }
    
    const { externalSpecs, allSpecDirectories } = extractSpecsInfo(specs, projectRoot);
    
    const hasDirectories = reportSpecDirectories(allSpecDirectories, results);
    
    if (!hasDirectories) {
      return results;
    }
    
    // Process all markdown files in all terms directories
    for (const termsDir of allSpecDirectories) {
      const markdownFiles = getMarkdownFiles(termsDir, results);
      
      for (const mdFile of markdownFiles) {
        validateMarkdownFile(mdFile, externalSpecs, results);
      }
    }
    
    return results;
  } catch (error) {
    Logger.error('Error checking term references:', error);
    return [{
      name: 'Term references check',
      success: false,
      details: `Error: ${error.message}`
    }];
  }
}

module.exports = {
  checkTermReferences
};