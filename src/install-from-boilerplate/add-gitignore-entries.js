const fs = require('fs').promises;
const Logger = require('../utils/logger');

/**
 * Reads the content of a file or returns an empty string if the file does not exist.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} - The content of the file or an empty string.
 */
async function readFileOrCreateEmpty(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}

/**
 * Updates the .gitignore file with the specified files.
 * @param {string} gitignorePath - The path to the .gitignore file.
 * @param {string[]} filesToAdd - The list of files to add to .gitignore.
 */
async function updateGitignore(gitignorePath, filesToAdd) {
    try {
        // Read the .gitignore file or create an empty one if it doesn't exist
        let gitignoreContent = await readFileOrCreateEmpty(gitignorePath);

        // Split the content into lines and remove empty lines
        const gitignoreLines = gitignoreContent.split('\n').filter(line => line.trim() !== '');

        // Add files to .gitignore if they are not already present
        filesToAdd.forEach(file => {
            if (!gitignoreLines.some(line => line.trim() === file.trim())) {
                gitignoreLines.push(file.trim());
            }
        });

        // Join the lines back into a single string
        const updatedGitignoreContent = gitignoreLines.join('\n') + '\n';

        // Write the updated content back to the .gitignore file
        await fs.writeFile(gitignorePath, updatedGitignoreContent, 'utf8');

        Logger.success('Updated .gitignore file');
    } catch (error) {
        Logger.error('Error updating .gitignore:', error.message);
    }
}

module.exports = { updateGitignore};