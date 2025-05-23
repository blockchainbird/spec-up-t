const fs = require('fs');
const path = require('path');
const { shouldProcessFile } = require('./utils/file-filter');

/**
 * Handles specific functionality for `[[def:` lines
 * @param {string[]} lines - Array of file lines
 * @returns {object} - Object containing modified lines and modification status
 */
function processDefLines(lines) {
    const result = [...lines];
    let modified = false;

    for (let i = 0; i < result.length; i++) {
        if (result[i].startsWith('[[def:')) {
            // Ensure a blank line immediately follows `[[def:` lines
            if (i + 1 < result.length && result[i + 1].trim() !== '') {
                result.splice(i + 1, 0, ''); // Insert blank line
                modified = true;
            }
        }
    }

    return { lines: result, modified };
}

/**
 * Ensures there is exactly one blank line between paragraphs
 * @param {string[]} lines - Array of file lines
 * @returns {object} - Object containing modified lines and modification status
 */
function normalizeParagraphSpacing(lines) {
    let newLines = [];
    let previousLineWasEmpty = false;
    let modified = false;

    for (const line of lines) {
        const isCurrentLineEmpty = line.trim() === '';

        if (!isCurrentLineEmpty) {
            newLines.push(line); // Add non-empty lines
            previousLineWasEmpty = false;
        } else if (!previousLineWasEmpty) {
            newLines.push(''); // Add exactly one blank line
            previousLineWasEmpty = true;
        } else {
            modified = true; // Skip additional blank lines
        }
    }

    return { lines: newLines, modified };
}

/**
 * Prepends `~ ` to appropriate lines
 * @param {string[]} lines - Array of file lines
 * @returns {object} - Object containing modified lines and modification status
 */
function prependTildeToLines(lines) {
    const result = [...lines];
    let modified = false;

    for (let i = 0; i < result.length; i++) {
        if (
            !result[i].startsWith('[[def:') &&
            !result[i].startsWith('[[tref:') &&
            result[i].trim() !== '' &&
            !result[i].startsWith('~ ') &&
            !result[i].trim().startsWith('<!--')
        ) {
            result[i] = `~ ${result[i]}`;
            modified = true;
        }
    }

    return { lines: result, modified };
}

/**
 * Ensures there is exactly one blank line at the end of the file
 * @param {string[]} lines - Array of file lines
 * @returns {object} - Object containing modified lines and modification status
 */
function ensureTrailingNewline(lines) {
    const result = [...lines];
    let modified = false;

    if (result[result.length - 1] !== '') {
        result.push('');
        modified = true;
    }

    return { lines: result, modified };
}

/**
 * Processes a single markdown file and applies formatting rules
 * @param {string} filePath - Path to the markdown file
 * @returns {void}
 */
function processMarkdownFile(filePath, fileName) {
    try {
        // Read the file synchronously
        let data = fs.readFileSync(filePath, 'utf8');

        // Split the content into lines
        let lines = data.split('\n');
        let modified = false;

        // Apply each processing function in sequence
        const defResult = processDefLines(lines);
        lines = defResult.lines;
        modified = modified || defResult.modified;

        const spacingResult = normalizeParagraphSpacing(lines);
        lines = spacingResult.lines;
        modified = modified || spacingResult.modified;

        const tildeResult = prependTildeToLines(lines);
        lines = tildeResult.lines;
        modified = modified || tildeResult.modified;

        const newlineResult = ensureTrailingNewline(lines);
        lines = newlineResult.lines;
        modified = modified || newlineResult.modified;

        // Write the modified content back to the file synchronously if there were any changes
        if (modified) {
            const newData = lines.join('\n');
            fs.writeFileSync(filePath, newData, 'utf8');
        }
    } catch (err) {
        console.error(`❌ Error while trying to fix the markdown in file ${fileName}: ${err}`);
    }
}

/**
 * Processes markdown files in a directory recursively
 * @param {string} directory - The directory to process
 * @returns {void}
 */
function fixMarkdownFiles(directory) {
    try {
        // Read the contents of the directory synchronously
        const items = fs.readdirSync(directory, { withFileTypes: true });

        // Loop through each item in the directory
        items.forEach(item => {
            const itemPath = path.join(directory, item.name);
            if (item.isDirectory()) {
                // If the item is a directory, call fixMarkdownFiles recursively
                fixMarkdownFiles(itemPath);
            } else if (item.isFile() && shouldProcessFile(item.name)) {
                processMarkdownFile(itemPath, item.name);
            }
        });
    } catch (err) {
        console.error(`❌ Error reading directory: ${err}`);
    }
}

module.exports = {
    fixMarkdownFiles
};
