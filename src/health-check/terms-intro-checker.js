const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

/**
 * Check if the terms-and-definitions-intro.md file exists in the spec directory
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkTermsIntroFile(projectRoot) {
  const results = [];
  
  try {
    // Path to the project's specs.json
    const specsPath = path.join(projectRoot, 'specs.json');
    
    // Check if specs.json exists
    if (!fs.existsSync(specsPath)) {
      return [{
        name: 'Find specs.json file',
        success: false,
        details: 'specs.json file not found in project root'
      }];
    }
    
    results.push({
      name: 'Find specs.json file',
      success: true,
      details: 'specs.json file found'
    });
    
    // Read specs.json to get the spec directory
    const specsContent = fs.readFileSync(specsPath, 'utf8');
    const specs = JSON.parse(specsContent);
    
    // Get the spec_directory value
    const specDir = specs.specs?.[0]?.spec_directory;
    
    if (!specDir) {
      results.push({
        name: 'Find spec_directory field',
        success: false,
        details: 'spec_directory field not found in specs.json'
      });
      return results;
    }
    
    results.push({
      name: 'Find spec_directory field',
      success: true,
      details: `spec_directory field found: "${specDir}"`
    });
    
    // Build the path to the terms-and-definitions-intro.md file
    const specDirPath = path.resolve(projectRoot, specDir);
    const termsIntroPath = path.join(specDirPath, 'terms-and-definitions-intro.md');
    
    // Check if the terms-and-definitions-intro.md file exists
    const termsIntroExists = fs.existsSync(termsIntroPath);
    
    results.push({
      name: 'Find terms-and-definitions-intro.md file',
      success: termsIntroExists,
      details: termsIntroExists 
        ? 'terms-and-definitions-intro.md file found in spec directory'
        : `terms-and-definitions-intro.md file not found in ${specDirPath}`
    });
    
    return results;
  } catch (error) {
    Logger.error('Error checking terms-and-definitions-intro.md file:', error);
    return [{
      name: 'Terms intro file check',
      success: false,
      details: `Error: ${error.message}`
    }];
  }
}

module.exports = {
  checkTermsIntroFile
};