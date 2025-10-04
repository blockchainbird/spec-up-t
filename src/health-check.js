#!/usr/bin/env node

/**
 * @fileoverview Spec-Up-T Health Check Tool
 * 
 * This script performs comprehensive health checks on Spec-Up-T projects,
 * validating configuration, external references, term definitions, and more.
 * Generates an HTML report with detailed results and actionable feedback.
 * 
 * @author Spec-Up-T Team
 * @version 1.0.0
 * @since 2025-06-06
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} name - Name of the specific check
 * @property {boolean|string} success - Success status (true, false, or 'partial')
 * @property {string} [status] - Status override ('warning', 'pass', 'fail')
 * @property {string} [details] - Additional details about the check result
 */

/**
 * @typedef {Object} HealthCheckSection
 * @property {string} title - Title of the check section
 * @property {HealthCheckResult[]} results - Array of individual check results
 */

/**
 * @typedef {Object} RepositoryInfo
 * @property {string} host - Git hosting service (e.g., 'github')
 * @property {string} account - Account/organization name
 * @property {string} repo - Repository name
 * @property {string} [branch] - Branch name
 * @property {boolean} [verified] - Whether repository existence was verified
 */

/**
 * @typedef {Object} StatusDisplay
 * @property {string} statusClass - CSS class for styling
 * @property {string} statusIcon - HTML icon element
 * @property {string} statusText - Display text for status
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./utils/logger');
const https = require('https');
const fileOpener = require('./utils/file-opener');

// Import modules from the health-check directory
const externalSpecsChecker = require('./health-check/external-specs-checker');
const termReferencesChecker = require('./health-check/term-references-checker');
const specsConfigurationChecker = require('./health-check/specs-configuration-checker');
const termsIntroChecker = require('./health-check/terms-intro-checker');
const destinationGitignoreChecker = require('./health-check/destination-gitignore-checker');
const trefTermChecker = require('./health-check/tref-term-checker');

/**
 * Directory where health check reports are generated
 * @constant {string}
 */
const OUTPUT_DIR = path.join(process.cwd(), '.cache');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Retrieves repository information from specs.json file
 * 
 * Reads the specs.json file to extract repository configuration including
 * host, account, repo name, and branch. Falls back to default values if
 * the file doesn't exist or is missing required fields.
 * 
 * @async
 * @function getRepoInfo
 * @returns {Promise<RepositoryInfo>} Repository information object
 * 
 * @example
 * const repoInfo = await getRepoInfo();
 * console.log(repoInfo.account); // 'blockchain-bird'
 */
async function getRepoInfo() {
    try {
        // Path to the default boilerplate specs.json
        const defaultSpecsPath = path.join(
            __dirname,
            'install-from-boilerplate',
            'boilerplate',
            'specs.json'
        );
        
        let defaultValues = {
            host: 'github',
            account: 'blockchain-bird',
            repo: 'spec-up-t'
        };

        // Try to load default values from boilerplate specs.json
        if (fs.existsSync(defaultSpecsPath)) {
            try {
                const defaultSpecsContent = fs.readFileSync(defaultSpecsPath, 'utf8');
                const defaultSpecs = JSON.parse(defaultSpecsContent);
                
                if (defaultSpecs?.specs?.[0]?.source) {
                    const source = defaultSpecs.specs[0].source;
                    defaultValues = {
                        host: source.host || defaultValues.host,
                        account: source.account || defaultValues.account,
                        repo: source.repo || defaultValues.repo
                    };
                }
            } catch (error) {
                Logger.error('Error reading boilerplate specs.json:', error);
            }
        }

        // Look for specs.json in the current working directory (where the command is run from)
        const specsPath = path.join(process.cwd(), 'specs.json');
        
        if (fs.existsSync(specsPath)) {
            const specsContent = fs.readFileSync(specsPath, 'utf8');
            const specs = JSON.parse(specsContent);
            
            // Check if source field exists and has required properties
            if (specs?.specs?.[0]?.source?.host && 
                specs?.specs?.[0]?.source?.account && 
                specs?.specs?.[0]?.source?.repo) {
                
                const sourceInfo = specs.specs[0].source;
                
                // Check if values have been changed from defaults
                const valuesChanged = 
                    sourceInfo.host !== defaultValues.host ||
                    sourceInfo.account !== defaultValues.account ||
                    sourceInfo.repo !== defaultValues.repo;
                
                // If values haven't changed, just return the default values
                // This allows the user to manually change these later
                if (!valuesChanged) {
                    return {
                        host: sourceInfo.host,
                        account: sourceInfo.account,
                        repo: sourceInfo.repo,
                        branch: sourceInfo.branch || defaultValues.branch
                    };
                }
                
                // If values have changed, verify the repository exists
                const repoExists = await checkRepositoryExists(
                    sourceInfo.host,
                    sourceInfo.account,
                    sourceInfo.repo
                );
                
                if (repoExists) {
                    // Repository exists, return the verified info
                    return {
                        host: sourceInfo.host,
                        account: sourceInfo.account,
                        repo: sourceInfo.repo,
                        branch: sourceInfo.branch || defaultValues.branch,
                        verified: true
                    };
                } else {
                    // Repository doesn't exist, but values have been changed
                    // Return the values with a verification failed flag
                    return {
                        host: sourceInfo.host,
                        account: sourceInfo.account,
                        repo: sourceInfo.repo,
                        branch: sourceInfo.branch || defaultValues.branch,
                        verified: false
                    };
                }
            }
        } else {
            Logger.info('specs.json not found');
        }
    } catch (error) {
        Logger.error('Error reading specs.json:', error);
    }
    
    // Return default values if specs.json doesn't exist or doesn't contain the required information
    return {
        host: 'github',
        account: 'blockchain-bird',
        repo: 'spec-up-t',
        branch: 'main'
    };
}

/**
 * Checks if a Git repository exists and is accessible
 * 
 * Makes an HTTP HEAD request to verify repository existence without
 * downloading the full repository content. Handles timeouts and errors gracefully.
 * 
 * @function checkRepositoryExists
 * @param {string} host - Git hosting service (e.g., 'github')
 * @param {string} account - Account or organization name
 * @param {string} repo - Repository name
 * @returns {Promise<boolean>} True if repository exists and is accessible
 * 
 * @example
 * const exists = await checkRepositoryExists('github', 'blockchain-bird', 'spec-up-t');
 * if (exists) {
 *   console.log('Repository is accessible');
 * }
 */
function checkRepositoryExists(host, account, repo) {
    return new Promise((resolve) => {
        const url = `https://${host}.com/${account}/${repo}`;
        
        try {
            const request = https.request(url, { method: 'HEAD', timeout: 10000 }, (response) => {
                // 200, 301, 302 status codes indicate the repo exists
                const exists = [200, 301, 302].includes(response.statusCode);
                resolve(exists);
            });
            
            request.on('error', (error) => {
                Logger.error('Error checking repository existence:', error.message);
                resolve(false);
            });
            
            request.on('timeout', () => {
                Logger.error('Timeout checking repository existence');
                request.destroy();
                resolve(false);
            });
            
            request.end();
        } catch (error) {
            Logger.error('Error checking repository existence:', error.message);
            resolve(false);
        }
    });
}

/**
 * Formats current timestamp for use in filenames
 * 
 * Generates a timestamp string that is safe to use in filenames by
 * replacing special characters with hyphens. Format: YYYY-MM-DD-HH-mm-ssZ
 * 
 * @function getFormattedTimestamp
 * @returns {string} Formatted timestamp string suitable for filenames
 * 
 * @example
 * const timestamp = getFormattedTimestamp();
 * console.log(timestamp); // "2025-06-06-14-30-25Z"
 */
function getFormattedTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/[T:]/g, '-')
        .replace(/\..+/, '')
        .replace(/Z/g, 'Z');
}

/**
 * Generates a human-readable timestamp for display in reports
 * 
 * Creates a localized timestamp string for display purposes,
 * using the system's default locale and timezone.
 * 
 * @function getHumanReadableTimestamp
 * @returns {string} Human-readable timestamp string
 * 
 * @example
 * const readable = getHumanReadableTimestamp();
 * console.log(readable); // "6/6/2025, 2:30:25 PM"
 */
function getHumanReadableTimestamp() {
    return new Date().toLocaleString();
}

/**
 * Determines status display parameters based on check result
 * 
 * Analyzes check results to determine appropriate CSS classes,
 * icons, and text for visual status representation in the HTML report.
 * 
 * @function getStatusDisplay
 * @param {HealthCheckResult} result - Check result object
 * @returns {StatusDisplay} Status display configuration
 * 
 * @example
 * const display = getStatusDisplay({ success: true });
 * console.log(display.statusText); // "Pass"
 */
function getStatusDisplay(result) {
    if (result.status === 'warning' || result.success === 'partial') {
        // Warning status
        return {
            statusClass: 'text-warning',
            statusIcon: '<i class="bi bi-exclamation-triangle-fill"></i>',
            statusText: 'Warning'
        };
    } else if (result.success) {
        // Pass status
        return {
            statusClass: 'text-success',
            statusIcon: '<i class="bi bi-check-circle-fill"></i>',
            statusText: 'Pass'
        };
    } else {
        // Fail status
        return {
            statusClass: 'text-danger',
            statusIcon: '<i class="bi bi-x-circle-fill"></i>',
            statusText: 'Fail'
        };
    }
}

/**
 * Main function to run all health checks and generate the report
 * 
 * Orchestrates the execution of all available health check modules,
 * collects results, and generates a comprehensive HTML report.
 * Handles errors gracefully and ensures proper cleanup.
 * 
 * @async
 * @function runHealthCheck
 * @throws {Error} When health check execution fails
 * 
 * @description
 * The function performs the following checks:
 * - Term reference checks in external specs
 * - External specs URL validation
 * - Term references validation
 * - specs.json configuration validation
 * - Terms introduction file validation
 * - .gitignore destination directory check
 * 
 * @example
 * try {
 *   await runHealthCheck();
 *   console.log('Health check completed successfully');
 * } catch (error) {
 *   console.error('Health check failed:', error);
 * }
 */
async function runHealthCheck() {
    Logger.info('Running health checks...');

    // Collection to store all check results
    const results = [];

  try {
      
        // Run term reference tref check
        const trefTermResults = await trefTermChecker.checkTrefTerms(process.cwd());
        results.push({
          title: 'Check Trefs in all external specs',
          results: trefTermResults
        });

        // Run external specs URL check
        const externalSpecsResults = await externalSpecsChecker.checkExternalSpecs(process.cwd());
        results.push({
            title: 'Check External Specs URL',
            results: externalSpecsResults
        });

        // Run term references check
        const termReferencesResults = await termReferencesChecker.checkTermReferences(process.cwd());
        results.push({
            title: 'Check Term References',
            results: termReferencesResults
        });

        // Run specs.json configuration check
        const specsConfigResults = await specsConfigurationChecker.checkSpecsJsonConfiguration(process.cwd());
        results.push({
            title: 'Check <code>specs.json</code> configuration',
            results: specsConfigResults
        });

        // Run terms-and-definitions-intro.md check
        const termsIntroResults = await termsIntroChecker.checkTermsIntroFile(process.cwd());
        results.push({
            title: 'Check <code>terms-and-definitions-intro.md</code>',
            results: termsIntroResults
        });

        // Run destination directory gitignore check
        const destinationGitignoreResults = await destinationGitignoreChecker.checkDestinationGitIgnore(process.cwd());
        results.push({
            title: 'Check <code>.gitignore</code>',
            results: destinationGitignoreResults
        });

        // Add more checks here in the future

        // Generate and open the report
        await generateReport(results);
    } catch (error) {
        console.error('Error running health checks:', error);
        process.exit(1);
    }
}

/**
 * Generates and opens an HTML health check report
 * 
 * Creates a comprehensive HTML report with all health check results,
 * saves it to the cache directory, and opens it in the default browser.
 * The report includes interactive features like filtering and status indicators.
 * 
 * @async
 * @function generateReport
 * @param {HealthCheckSection[]} checkResults - Array of health check result objects
 * @throws {Error} When report generation or file operations fail
 * 
 * @example
 * const results = [
 *   {
 *     title: 'Configuration Check',
 *     results: [{ name: 'specs.json', success: true, details: 'Valid' }]
 *   }
 * ];
 * await generateReport(results);
 */
async function generateReport(checkResults) {
    const timestamp = getFormattedTimestamp();
    // Get repository information from specs.json
    const repoInfo = await getRepoInfo();
    const reportFileName = `health-check-${timestamp}-${repoInfo.account}-${repoInfo.repo}.html`;
    const reportPath = path.join(OUTPUT_DIR, reportFileName);

    
    const htmlContent = generateHtmlReport(checkResults, getHumanReadableTimestamp(), repoInfo);

    fs.writeFileSync(reportPath, htmlContent);
    console.log(`Report generated: ${reportPath}`);

    // Open the report in the default browser
    try {
        const success = fileOpener.openHtmlFile(reportPath);
        if (!success) {
            console.error('Failed to open the report in browser');
        }
    } catch (error) {
        console.error('Failed to open the report:', error);
    }
}

/**
 * Generates HTML content for the health check report
 * 
 * Creates a complete HTML document with Bootstrap styling, interactive features,
 * and comprehensive health check results. Includes repository verification,
 * status filtering, and detailed result tables.
 * 
 * @function generateHtmlReport
 * @param {HealthCheckSection[]} checkResults - Array of health check result sections
 * @param {string} timestamp - Human-readable timestamp for the report
 * @param {RepositoryInfo} repoInfo - Repository information object
 * @returns {string} Complete HTML document as string
 * 
 * @example
 * const html = generateHtmlReport(results, '6/6/2025, 2:30:25 PM', {
 *   host: 'github',
 *   account: 'blockchain-bird',
 *   repo: 'spec-up-t'
 * });
 */
function generateHtmlReport(checkResults, timestamp, repoInfo) {
    let resultsHtml = '';

    // Add repository verification check at the beginning if needed
    if (repoInfo && repoInfo.verified === false) {
        const failStatus = {
            statusClass: 'text-danger',
            statusIcon: '<i class="bi bi-x-circle-fill"></i>',
            statusText: 'Fail'
        };
        
        // Create a new section at the top for repository verification
        resultsHtml += `
      <div class="card mb-4 results-card alert-danger" data-section="repository-verification">
        <div class="card-header bg-danger text-white">
          <h5>Repository Verification</h5>
        </div>
        <div class="card-body">
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Status</th>
                <th>Check</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr data-status="fail" class="check-row">
                <td class="${failStatus.statusClass}" style="white-space: nowrap;">
                  ${failStatus.statusIcon} <span style="vertical-align: middle;">${failStatus.statusText}</span>
                </td>
                <td>Repository existence check</td>
                <td>The repository at https://${repoInfo.host}.com/${repoInfo.account}/${repoInfo.repo} does not exist or is not accessible. Please verify the repository information in specs.json.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    }

    checkResults.forEach(section => {
        resultsHtml += `
      <div class="card mb-4 results-card" data-section="${section.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}">
        <div class="card-header">
          <h5>${section.title}</h5>
        </div>
        <div class="card-body">
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Status</th>
                <th>Check</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
    `;

        section.results.forEach(result => {
            const { statusClass, statusIcon, statusText } = getStatusDisplay(result);

            // Add data-status attribute to identify rows by status and reorder columns to put status first
            resultsHtml += `
        <tr data-status="${statusText.toLowerCase()}" class="check-row">
          <td class="${statusClass}" style="white-space: nowrap;">
            ${statusIcon} <span style="vertical-align: middle;">${statusText}</span>
          </td>
          <td>${result.name}</td>
          <td>${result.details || ''}</td>
        </tr>
      `;
        });

        resultsHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    });

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Spec-Up-T Health Check Report</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
      <style>
        body {
          padding-top: 2rem;
          padding-bottom: 2rem;
        }
        .report-header {
          margin-bottom: 2rem;
        }
        .timestamp {
          color: #6c757d;
        }
        .filter-toggle {
          margin-bottom: 1rem;
        }
        .hidden-item {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="report-header">
          <h1>Spec-Up-T Health Check Report</h1>
          <p class="timestamp">Generated: ${timestamp}</p>
          <p class="repo-info">
            Repository: <a href="https://${repoInfo.host}.com/${repoInfo.account}/${repoInfo.repo}" target="_blank">https://${repoInfo.host}.com/${repoInfo.account}/${repoInfo.repo}</a><br>
            Username: ${repoInfo.account}<br>
            Repo name: ${repoInfo.repo}
          </p>
        </div>
        
        <div class="filter-toggle form-check form-switch">
          <input class="form-check-input" type="checkbox" id="togglePassingChecks" checked>
          <label class="form-check-label" for="togglePassingChecks">Show / hide passing checks</label>
        </div>
        
        <div class="results">
          ${resultsHtml}
        </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
        // Toggle function for passing checks
        document.getElementById('togglePassingChecks').addEventListener('change', function() {
          const showPassing = this.checked;
          const passingRows = document.querySelectorAll('tr[data-status="pass"]');
          
          // Hide/show passing rows
          passingRows.forEach(row => {
            if (showPassing) {
              row.classList.remove('hidden-item');
            } else {
              row.classList.add('hidden-item');
            }
          });
          
          // Check each results card to see if it should be hidden
          document.querySelectorAll('.results-card').forEach(card => {
            const visibleRows = card.querySelectorAll('tr.check-row:not(.hidden-item)');
            
            if (visibleRows.length === 0) {
              // If no visible rows, hide the entire card
              card.classList.add('hidden-item');
            } else {
              // Otherwise show it
              card.classList.remove('hidden-item');
            }
          });
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Script execution entry point
 * 
 * Immediately executes the health check when this script is run directly.
 * This allows the script to be used as a standalone command-line tool.
 * 
 * @example
 * // Run from command line:
 * // node src/health-check.js
 * // npm run healthCheck
 */
runHealthCheck();