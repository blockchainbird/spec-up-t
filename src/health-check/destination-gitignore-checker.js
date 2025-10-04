/**
 * @file destination-gitignore-checker.js
 * @description Checks if the final destination directory (from output_path in specs.json) 
 * is being ignored by Git. This is the directory where index.html is generated, 
 * NOT the temporary .cache directory (formerly called "output").
 * 
 * Important: This file deals with concept #1 (output_path from specs.json),
 * not concept #2 (the temporary .cache directory for build artifacts).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fileOpener = require('../utils/file-opener');
const Logger = require('../utils/logger');
const { utils } = require('../utils/regex-patterns');

/**
 * Checks if a path is gitignored
 * @param {string} projectRoot - Root directory of the project
 * @param {string} targetPath - Path to check (relative to project root)
 * @returns {boolean} - Whether the path is gitignored
 */
function isPathGitIgnored(projectRoot, targetPath) {
  try {
    // Use git check-ignore to determine if the path is ignored
    // If command exits with status 0, path is ignored
    // If command exits with status 1, path is not ignored
    const gitPath = fileOpener.getCommandPath('git');
    const result = spawnSync(gitPath, ['-C', projectRoot, 'check-ignore', '-q', targetPath], { 
      stdio: 'ignore' 
    });
    return result.status === 0; // Path is ignored (command exited with status 0)
  } catch (error) {
    Logger.info(`Error checking if path is gitignored: ${error.message}`);
    return false; // Path is not ignored (command exited with non-zero status)
  }
}

/**
 * Check if specs.json exists and return relevant result
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - Result object with specs file check result
 */
function checkSpecsFileExists(projectRoot) {
  const specsPath = path.join(projectRoot, 'specs.json');
  
  if (!fs.existsSync(specsPath)) {
    return {
      result: [{
        name: 'Find specs.json file',
        success: false,
        details: 'specs.json file not found in project root'
      }],
      specsPath: null
    };
  }
  
  return {
    result: [{
      name: 'Find specs.json file',
      success: true,
      details: 'specs.json file found'
    }],
    specsPath
  };
}

/**
 * Extract output path from specs.json
 * @param {string} specsPath - Path to specs.json file
 * @returns {Object} - Result object with output path check result
 */
function extractOutputPath(specsPath) {
  const results = [];
  
  // Read specs.json to get the output path
  const specsContent = fs.readFileSync(specsPath, 'utf8');
  const specs = JSON.parse(specsContent);
  
  // Get the output_path value
  const outputPath = specs.specs?.[0]?.output_path;
  
  if (!outputPath) {
    results.push({
      name: 'Find output_path field',
      success: false,
      details: 'output_path field not found in specs.json'
    });
    return { results, outputPath: null };
  }
  
  results.push({
    name: 'Find output_path field',
    success: true,
    details: `output_path field found: "${outputPath}"`
  });
  
  // Normalize the path to handle different formats (./, /, etc.)
  const normalizedPath = outputPath.replace(/^\.\/|^\//, '');
  
  return { results, outputPath, normalizedPath };
}

/**
 * Check if the final destination directory (from output_path) exists
 * @param {string} projectRoot - Root directory of the project
 * @param {string} outputPath - Output path from specs.json
 * @param {string} normalizedPath - Normalized output path
 * @returns {Object} - Result with final destination directory check
 */
function checkOutputDirExists(projectRoot, outputPath, normalizedPath) {
  // Check if the path exists
  const fullPath = path.join(projectRoot, normalizedPath);
  const outputPathExists = fs.existsSync(fullPath);
  
  if (!outputPathExists) {
    return {
      name: 'Final destination directory existence',
      status: 'warning',
      success: true, // Still considered a "success" for backward compatibility
      details: `Final destination directory "${outputPath}" does not exist yet. This is OK if you haven't rendered the specs yet.`
    };
  } 
  
  return {
    name: 'Final destination directory existence',
    success: true,
    details: `Final destination directory "${outputPath}" exists`
  };
}

/**
 * Check if .gitignore file exists
 * @param {string} projectRoot - Root directory of the project
 * @param {string} normalizedPath - Normalized output path 
 * @returns {Object} - Result with gitignore check details
 */
function checkGitignoreExists(projectRoot, normalizedPath) {
  const results = [];
  
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    results.push({
      name: 'Find .gitignore file',
      status: 'warning',
      success: true, // Still considered a "success" for backward compatibility
      details: '.gitignore file not found in project root. Consider adding one for better version control.'
    });
    
    // If no .gitignore, we can assume the output path is not ignored
    results.push({
      name: 'Check if output directory is gitignored',
      success: true,
      details: 'No .gitignore file found, so output directory is not being ignored'
    });
    
    return { results, gitignoreExists: false };
  }
  
  results.push({
    name: 'Find .gitignore file',
    success: true,
    details: '.gitignore file found'
  });
  
  return { results, gitignoreExists: true, gitignorePath };
}

/**
 * Filter non-comment lines from gitignore content
 * @param {string} content - Content of .gitignore file
 * @returns {Array} - Array of non-comment, non-empty lines
 */
function getRelevantGitignoreLines(content) {
  const allLines = content.split('\n');
  
  return allLines.filter(line => {
    const trimmedLine = line.trim();
    return trimmedLine !== '' && !trimmedLine.startsWith('#');
  }).map(line => line.trim());
}

/**
 * Check for patterns that might ignore output directory
 * @param {Array} lines - Array of gitignore lines
 * @param {string} normalizedPath - Normalized output path
 * @param {string} dirName - Directory name from path
 * @returns {Array} - Array of ignoring patterns found
 */
function findOutputDirIgnorePatterns(lines, normalizedPath, dirName) {
  const dirIgnorePatterns = [];
  
  for (const trimmedLine of lines) {
    // Directly check for common patterns that would ignore the output directory
    if (
      trimmedLine === normalizedPath || 
      trimmedLine === `/${normalizedPath}` || 
      trimmedLine === `./${normalizedPath}` ||
      trimmedLine === `${normalizedPath}/` ||
      trimmedLine === `/${normalizedPath}/` ||
      trimmedLine === `./${normalizedPath}/` ||
      // Check for just the directory name (e.g., "docs")
      trimmedLine === dirName ||
      trimmedLine === `/${dirName}` ||
      trimmedLine === `./${dirName}` ||
      trimmedLine === `${dirName}/` ||
      trimmedLine === `/${dirName}/` ||
      trimmedLine === `./${dirName}/` ||
      // Check for wildcards covering all directories
      trimmedLine === '*/' ||
      // Check for wildcards that might match our path using regex
      (trimmedLine.includes('*') && utils.createGitignoreRegex(trimmedLine).test(normalizedPath))
    ) {
      dirIgnorePatterns.push(trimmedLine);
    }
  }
  
  return dirIgnorePatterns;
}

/**
 * Check for patterns that might ignore HTML files
 * @param {Array} lines - Array of gitignore lines
 * @returns {Array} - Array of HTML ignoring patterns found
 */
function findHtmlIgnorePatterns(lines) {
  const htmlIgnorePatterns = [];
  
  for (const trimmedLine of lines) {
    if (
      trimmedLine === 'index.html' || 
      trimmedLine === '*.html' || 
      trimmedLine === '/index.html' || 
      trimmedLine === '**/index.html' ||
      trimmedLine === '**/*.html'
    ) {
      htmlIgnorePatterns.push(trimmedLine);
    }
  }
  
  return htmlIgnorePatterns;
}

/**
 * Find complex patterns that might be affecting HTML files
 * @param {Array} lines - Array of gitignore lines
 * @returns {Array} - Array of complex patterns found
 */
function findComplexHtmlPatterns(lines) {
  const patterns = [];
  
  for (const trimmedLine of lines) {
    // Check for wildcards and patterns that might match index.html
    if (trimmedLine.includes('*') || trimmedLine.includes('.html')) {
      patterns.push(trimmedLine);
    }
  }
  
  return patterns;
}

/**
 * Check if HTML files in the final destination directory are being ignored by Git
 * @param {string} projectRoot - Root directory of the project
 * @param {string} normalizedPath - Normalized output path
 * @param {string} outputPath - Original output path
 * @param {Array} relevantLines - Relevant lines from .gitignore
 * @returns {Array} - Results for HTML files gitignore check
 */
function checkHtmlFilesGitignore(projectRoot, normalizedPath, outputPath, relevantLines) {
  const results = [];
  const htmlIgnorePatterns = findHtmlIgnorePatterns(relevantLines);
  
  if (htmlIgnorePatterns.length > 0) {
    results.push({
      name: 'Check if index.html files are gitignored',
      success: false,
      details: `Found patterns in .gitignore that would ignore HTML files: ${htmlIgnorePatterns.join(', ')}. This is problematic as they're crucial output files.`
    });
    return results;
  }
  
  // Check if index.html would be ignored
  const indexHtmlPath = path.join(normalizedPath, 'index.html');
  const isIndexHtmlIgnored = isPathGitIgnored(projectRoot, indexHtmlPath);
  
  results.push({
    name: 'Check if index.html files are gitignored',
    success: !isIndexHtmlIgnored,
    details: isIndexHtmlIgnored 
      ? `index.html files in the final destination directory would be ignored by Git. This is problematic as they're crucial output files.`
      : `index.html files in the final destination directory are properly tracked by Git.`
  });
  
  // If index.html is ignored but we couldn't find an explicit pattern, look for more complex patterns
  if (isIndexHtmlIgnored && htmlIgnorePatterns.length === 0) {
    const complexPatterns = findComplexHtmlPatterns(relevantLines);
    
    if (complexPatterns.length > 0) {
      results.push({
        name: 'Found complex .gitignore entries potentially affecting HTML files',
        status: 'warning',
        success: true, // Still considered a "success" for backward compatibility
        details: `The following entries in .gitignore might cause HTML files to be ignored: ${complexPatterns.join(', ')}. Consider reviewing these patterns.`
      });
    }
  }
  
  return results;
}

/**
 * Check if final destination directory (from output_path) is being ignored by Git
 * @param {string} projectRoot - Root directory of the project
 * @param {string} normalizedPath - Normalized output path
 * @param {string} outputPath - Original output path
 * @param {string} dirName - Directory name from path
 * @param {Array} relevantLines - Relevant lines from .gitignore
 * @returns {Array} - Results for final destination directory gitignore check
 */
function checkOutputDirIgnorePatterns(projectRoot, normalizedPath, outputPath, dirName, relevantLines) {
  const dirIgnorePatterns = findOutputDirIgnorePatterns(relevantLines, normalizedPath, dirName);
  
  if (dirIgnorePatterns.length > 0) {
    return [{
      name: 'Check if final destination directory is gitignored',
      success: false,
      details: `Found patterns in .gitignore that would ignore the final destination directory: ${dirIgnorePatterns.join(', ')}. Remove these entries to ensure generated content is tracked.`
    }];
  }
  
  // Fall back to using git check-ignore for verification
  const isIgnored = isPathGitIgnored(projectRoot, normalizedPath);
  
  return [{
    name: 'Check if final destination directory is gitignored',
    success: !isIgnored,
    details: isIgnored 
      ? `Final destination directory "${outputPath}" is being ignored by Git. This could be due to a complex pattern in .gitignore. Remove any entries that might affect this directory.`
      : `Final destination directory "${outputPath}" is not being ignored by Git, which is good.`
  }];
}

/**
 * Check if the final destination directory (from output_path in specs.json) is being ignored by Git
 * This checks the directory where index.html is generated, NOT the temporary .cache directory
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkDestinationGitIgnore(projectRoot) {
  const results = [];
  
  try {
    // Check if specs.json exists
    const specsCheck = checkSpecsFileExists(projectRoot);
    if (!specsCheck.specsPath) {
      return specsCheck.result;
    }
    
    results.push(...specsCheck.result);
    
    // Extract and validate output path
    const outputPathCheck = extractOutputPath(specsCheck.specsPath);
    if (!outputPathCheck.outputPath) {
      return [...results, ...outputPathCheck.results];
    }
    
    results.push(...outputPathCheck.results);
    const { outputPath, normalizedPath } = outputPathCheck;
    
    // Check if output directory exists
    const outputDirResult = checkOutputDirExists(projectRoot, outputPath, normalizedPath);
    results.push(outputDirResult);
    
    // Check if .gitignore exists
    const gitignoreCheck = checkGitignoreExists(projectRoot, normalizedPath);
    results.push(...gitignoreCheck.results);
    
    if (!gitignoreCheck.gitignoreExists) {
      return results;
    }
    
    // Read .gitignore content and process it
    const gitignoreContent = fs.readFileSync(gitignoreCheck.gitignorePath, 'utf8');
    const relevantLines = getRelevantGitignoreLines(gitignoreContent);
    const dirName = path.basename(normalizedPath);
    
    // Check final destination directory ignore patterns
    const dirResults = checkOutputDirIgnorePatterns(
      projectRoot, normalizedPath, outputPath, dirName, relevantLines
    );
    results.push(...dirResults);
    
    // Check HTML files ignore patterns
    const htmlResults = checkHtmlFilesGitignore(
      projectRoot, normalizedPath, outputPath, relevantLines
    );
    results.push(...htmlResults);
    
    return results;
  } catch (error) {
    Logger.error('Error checking final destination directory gitignore status:', error);
    return [{
      name: 'Final destination directory gitignore check',
      success: false,
      details: `Error: ${error.message}`
    }];
  }
}

module.exports = {
  checkDestinationGitIgnore
};