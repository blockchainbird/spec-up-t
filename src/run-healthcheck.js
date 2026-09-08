/**
 * Health Check Integration Script for spec-up-t
 * 
 * This script integrates the spec-up-t-healthcheck tool to validate consuming projects.
 * It runs FROM spec-up-t (menu option 9) but checks the CONSUMING project (current directory).
 * 
 * Usage (from consuming project):
 *   npm run healthCheck
 * 
 * Or via spec-up-t menu:
 *   npm run menu -> [9] Run health check
 * 
 * Options:
 *   --format text|json|html    Output format (default: html)
 *   --output <file>            Output file path
 *   --checks <checks>          Comma-separated list of specific checks
 * 
 * Examples:
 *   node run-healthcheck.js
 *   node run-healthcheck.js --format json
 *   node run-healthcheck.js --format html --output health-report.html
 */

const fs = require('node:fs').promises;
const path = require('node:path');

/**
 * Parse command line arguments
 * Handles both direct node invocations and npm script invocations
 * 
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'html',  // Changed default to HTML for better user experience
    output: null,
    checks: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--checks' && args[i + 1]) {
      options.checks = args[i + 1].split(',');
      i++;
    }
  }

  return options;
}

/**
 * Main execution function
 * 
 * Runs health checks on the CONSUMING PROJECT (current working directory).
 * This script is part of spec-up-t but validates the project that uses spec-up-t.
 */
async function main() {
  try {
    console.log('🏥 Spec-Up-T Health Check\n');
    console.log('📍 Checking consuming project in:', process.cwd());
    console.log('');

    // Parse command line arguments
    const options = parseArgs();

    // Import the health check tool
    const {
      createProvider,
      runHealthChecks,
      formatResultsAsText,
      formatResultsAsJson,
      formatResultsAsHtml
    } = await import('spec-up-t-healthcheck');

    // Create a provider for the CURRENT WORKING DIRECTORY (the consuming project)
    const provider = createProvider(process.cwd());

    // Run health checks on the consuming project
    console.log('🔍 Running health checks on consuming project...');
    const healthCheckOptions = {};
    if (options.checks) {
      healthCheckOptions.checks = options.checks;
    }

    const results = await runHealthChecks(provider, healthCheckOptions);

    // Display summary
    console.log('\n📊 Health Check Summary:');
    console.log(`   Total Checks: ${results.summary.total}`);
    console.log(`   ✅ Passed: ${results.summary.passed}`);
    console.log(`   ❌ Failed: ${results.summary.failed}`);
    console.log(`   ⚠️  Warnings: ${results.summary.warnings}`);
    console.log(`   ⏭️  Skipped: ${results.summary.skipped}`);
    console.log(`   📈 Health Score: ${results.summary.score}%\n`);

    // Format results based on requested format
    let output;
    let defaultFilename;

    switch (options.format) {
      case 'json':
        output = formatResultsAsJson(results);
        defaultFilename = 'health-report.json';
        break;

      case 'html':
        output = formatResultsAsHtml(results, {
          title: 'Spec-Up-T Project Health Check',
          repositoryUrl: results.provider.repoPath ? 
            `file://${results.provider.repoPath}` : undefined
        });
        defaultFilename = 'health-report.html';
        break;

      case 'text':
      default:
        output = formatResultsAsText(results);
        defaultFilename = 'health-report.txt';
        break;
    }

    // Determine output path
    const outputPath = options.output || defaultFilename;

    // Save to file
    await fs.writeFile(outputPath, output);
    console.log(`📄 Report saved to: ${outputPath}`);

    // For HTML format, try to open in browser
    if (options.format === 'html' && !options.output) {
      try {
        const { openHtmlFile } = require('./utils/file-opener');
        await openHtmlFile(path.resolve(outputPath));
        console.log('🌐 Opening report in browser...');
      } catch (error) {
        console.log('ℹ️  Tip: Open the report manually in your browser');
      }
    }

    // For text format, also print to console
    if (options.format === 'text') {
      console.log('\n' + output);
    }

    // Exit with appropriate code
    if (results.summary.hasErrors) {
      console.error('\n❌ Health check completed with errors');
      console.error('   Please review the report for details');
      process.exit(1);
    } else if (results.summary.hasWarnings) {
      console.warn('\n⚠️  Health check completed with warnings');
      process.exit(0);
    } else {
      console.log('\n✅ Health check completed successfully');
      console.log('   All checks passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    console.error('\nDetails:', error.stack);
    console.error('\nTroubleshooting:');
    console.error('  - Ensure you are running this from a consuming project directory');
    console.error('  - Check that spec-up-t-healthcheck is properly installed');
    console.error('  - Verify the consuming project has a valid package.json');
    process.exit(1);
  }
}

// Run the script
main();
