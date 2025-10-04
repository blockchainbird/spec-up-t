/**
 * @file create-versions-index.js
 * @description This script reads the configuration from specs.json, checks for the existence of a versions directory, creates it if it doesn't exist, and generates an index.html file listing all version directories in the directory.
 * 
 * @requires fs-extra - File system operations with extra methods.
 * @requires path - Utilities for working with file and directory paths.
 * 
 * @example
 * // To run this script, use the following command:
 * // node create-versions-index.js
 * 
 * @version 1.0.0
 */

const fs = require('fs-extra');
const path = require('path');
const Logger = require('../../utils/logger.js');

function createVersionsIndex(outputPath) {
    // Directory containing the version files
    const versionsDir = path.join(outputPath, 'versions');

    // Check if the directory that holds the versions / snapshots exists, if not create it
    if (!fs.existsSync(versionsDir)) {
        fs.mkdirSync(versionsDir, { recursive: true });
        Logger.info('Directory created:', versionsDir);
    }
    
    // Get all directories in the destination directory
    const dirs = fs.readdirSync(versionsDir).filter(file => fs.statSync(path.join(versionsDir, file)).isDirectory());

    // Generate HTML content
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spec-Up-T Snapshot Index</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400&display=swap" rel="stylesheet">
  <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { font-family: 'Heebo', Arial, sans-serif; background: #A9DDE0}
    ul { list-style-type: none; padding: 0; }
    li { margin: 10px 0; }
    a { text-decoration: none; color: #007BFF; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body class="container mt-5">
  <h1 class="mb-4">Spec-Up-T Snapshot Index</h1>
  <p>This page lists all available snapshots of this Spec-Up-T specification.</p>
  <ul class="list-group">
    <li class="list-group-item"><a href="../">Latest version</a></li>
`;

    if (dirs.length === 0) {
        htmlContent += `    <li class="list-group-item">No versions available</li>\n`;
    } else {
        dirs.forEach(dir => {
            htmlContent += `    <li class="list-group-item"><a href="${dir}/">Version ${dir}</a></li>\n`;
        });
    }

    htmlContent += `
  </ul>
</body>
</html>
`;

    // Write the HTML content to the index file asynchronously
    const indexPath = path.join(versionsDir, 'index.html');
    fs.writeFile(indexPath, htmlContent, (err) => {
        if (err) {
            Logger.error(`Error writing index file: ${err}`);
        } else {
            Logger.success(`Index file created at ${indexPath}`);
        }
    });
}

// Export the function
module.exports = createVersionsIndex;

// If the script is run directly, execute the function
if (require.main === module) {
    createVersionsIndex();
}