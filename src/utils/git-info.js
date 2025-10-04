/**
 * Git information utility
 * 
 * Provides functions to extract Git repository information including
 * the current branch name and repository details from the working directory.
 * 
 * @author Spec-Up-T Team
 * @since 2025-08-31
 */

const { execSync } = require('child_process');
const Logger = require('./logger');

/**
 * Gets the current Git branch name
 * 
 * @returns {string} The current branch name, or 'main' as fallback
 */
function getCurrentBranch() {
    try {
        const branch = execSync('git branch --show-current', { 
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        if (branch) {
            Logger.info(`Current git branch: ${branch}`);
            return branch;
        }
        
        // Fallback to checking HEAD if branch name is empty (detached HEAD)
        const head = execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        
        if (head && head !== 'HEAD') {
            Logger.info(`Current git branch (from HEAD): ${head}`);
            return head;
        }
        
        Logger.warn('Could not determine git branch, using fallback: main');
        return 'main';
    } catch (error) {
        Logger.warn(`Could not get git branch (${error.message}), using fallback: main`);
        return 'main';
    }
}

/**
 * Creates GitHub repository information meta tag content
 * 
 * @param {Object} spec - The spec configuration object
 * @returns {string} Meta tag content in format "username,repo,branch"
 */
function getGithubRepoInfo(spec) {
    try {
        const source = spec.source || {};
        const account = source.account || 'unknown';
        const repo = source.repo || 'unknown';
        const branch = getCurrentBranch();
        
        const content = `${account},${repo},${branch}`;
        Logger.info(`GitHub repo info: ${content}`);
        return content;
    } catch (error) {
        Logger.warn(`Error generating GitHub repo info: ${error.message}`);
        return 'unknown,unknown,main';
    }
}

module.exports = {
    getCurrentBranch,
    getGithubRepoInfo
};
