/**
 * Utility functions to fetch and parse various JSON specification files
 */
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

/**
 * Fetches the .cache/specs-generated.json file and returns it as a JavaScript object
 * @returns {Object} The parsed contents of specs-generated.json
 */
function fetchSpecs() {
  try {
    // Resolve path to .cache/specs-generated.json from the project root
    const specsPath = path.resolve(process.cwd(), '.cache', 'specs-generated.json');
    
    // Read the file synchronously
    const specsContent = fs.readFileSync(specsPath, 'utf8');
    
    // Parse the JSON content
    const specs = JSON.parse(specsContent);
    
    return specs;
  } catch (error) {
    Logger.error('Error fetching .cache/specs-generated.json:', error.message);
    return null;
  }
}

/**
 * Fetches the .cache/xtrefs-data.json file and returns it as a JavaScript object
 * @returns {Object} The parsed contents of xtrefs-data.json
 */
function fetchExternalTerms() {
  try {
    // Resolve path to .cache/xtrefs-data.json from the project root
    const xtrefsPath = path.resolve(process.cwd(), '.cache', 'xtrefs-data.json');
    
    // Read the file synchronously
    const xtrefsContent = fs.readFileSync(xtrefsPath, 'utf8');
    
    // Parse the JSON content
    const xtrefs = JSON.parse(xtrefsContent);
    
    return xtrefs;
  } catch (error) {
    Logger.error('Error fetching .cache/xtrefs-data.json:', error.message);
    return null;
  }
}

/**
 * Asynchronous version of fetchGeneratedSpecs
 * @returns {Promise<Object>} The parsed specs-generated object
 */
async function fetchSpecsAsync() {
  try {
    // Resolve path to .cache/specs-generated.json from the project root
    const specsPath = path.resolve(process.cwd(), '.cache', 'specs-generated.json');
    
    // Read the file asynchronously
    const specsContent = await fs.promises.readFile(specsPath, 'utf8');
    
    // Parse the JSON content
    const specs = JSON.parse(specsContent);
    
    return specs;
  } catch (error) {
    Logger.error('Error fetching .cache/specs-generated.json:', error.message);
    return null;
  }
}

/**
 * Asynchronous version of fetchXtrefsData
 * @returns {Promise<Object>} The parsed xtrefs-data object
 */
async function fetchExternalTermsAsync() {
  try {
    // Resolve path to .cache/xtrefs-data.json from the project root
    const xtrefsPath = path.resolve(process.cwd(), '.cache', 'xtrefs-data.json');
    
    // Read the file asynchronously
    const xtrefsContent = await fs.promises.readFile(xtrefsPath, 'utf8');
    
    // Parse the JSON content
    const xtrefs = JSON.parse(xtrefsContent);
    
    return xtrefs;
  } catch (error) {
    Logger.error('Error fetching .cache/xtrefs-data.json:', error.message);
    return null;
  }
}

module.exports = {
  fetchSpecs,
  fetchSpecsAsync,
  fetchExternalTerms,
  fetchExternalTermsAsync
};