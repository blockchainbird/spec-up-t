const fs = require('fs');
const { spawnSync } = require('child_process');
const Logger = require('./logger');

/**
 * Helper function to get the absolute path of a command
 * @param {string} command - The command to find
 * @returns {string} - The absolute path to the command or the command name as fallback
 */
function getCommandPath(command) {
    // Define common system paths where commands are typically located
    const commonPaths = [
        `/usr/bin/${command}`,
        `/bin/${command}`,
        `/usr/local/bin/${command}`,
        `/opt/homebrew/bin/${command}`, // For Homebrew on Apple Silicon Macs
        `/opt/local/bin/${command}`,   // For MacPorts
    ];
    
    // For Windows, add common Windows paths
    if (process.platform === 'win32') {
        commonPaths.unshift(
            `C:\\Windows\\System32\\${command}.exe`,
            `C:\\Windows\\${command}.exe`,
            `C:\\Program Files\\Git\\bin\\${command}.exe`, // Git for Windows
            `C:\\Program Files (x86)\\Git\\bin\\${command}.exe`
        );
    }
    
    // Check each path to see if the command exists
    for (const cmdPath of commonPaths) {
        if (fs.existsSync(cmdPath)) {
            return cmdPath;
        }
    }
    
    // If we can't find the absolute path, return the command name as fallback
    // This maintains functionality while logging the issue
    Logger.warn(`Could not find absolute path for command '${command}', using relative path as fallback`);
    return command;
}

/**
 * Get the appropriate file open command based on platform
 * @returns {string} - The absolute path to the platform-specific open command
 */
function getOpenCommand() {
    let command;
    if (process.platform === 'win32') {
        command = 'start';
    } else if (process.platform === 'darwin') {
        command = 'open';
    } else {
        command = 'xdg-open';
    }
    
    return getCommandPath(command);
}

/**
 * Open a file in the default application for the current platform
 * @param {string} filePath - The path to the file to open
 * @returns {boolean} - True if the file was opened successfully, false otherwise
 */
function openFile(filePath) {
    try {
        const openCommand = getOpenCommand();
        const result = spawnSync(openCommand, [filePath], { stdio: 'ignore' });
        return result.status === 0;
    } catch (error) {
        Logger.error('Failed to open file:', error);
        return false;
    }
}

/**
 * Open an HTML file in the default web browser
 * @param {string} htmlFilePath - The path to the HTML file to open
 * @returns {boolean} - True if the file was opened successfully, false otherwise
 */
function openHtmlFile(htmlFilePath) {
    return openFile(htmlFilePath);
}

module.exports = {
    getCommandPath,
    getOpenCommand,
    openFile,
    openHtmlFile
};
