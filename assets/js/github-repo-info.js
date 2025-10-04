/**
 * GitHub Repository Information Utility
 * 
 * This client-side utility provides easy access to the GitHub repository
 * information embedded in the HTML meta tag by Spec-Up-T.
 * 
 * Usage:
 *   const repoInfo = getGithubRepoInfo();
 *   if (repoInfo) {
 *     console.log(`Repository: ${repoInfo.username}/${repoInfo.repo} on ${repoInfo.branch}`);
 *   }
 */

/**
 * Extracts GitHub repository information from the meta tag
 * @returns {Object|null} Repository information object or null if not found
 * @returns {string} returns.username - GitHub username/account
 * @returns {string} returns.repo - Repository name
 * @returns {string} returns.branch - Git branch name
 */
function getGithubRepoInfo() {
    try {
        const metaTag = document.querySelector('meta[property="spec-up-t:github-repo-info"]');
        if (!metaTag) {
            console.warn('GitHub repository meta tag not found');
            return null;
        }
        
        const content = metaTag.getAttribute('content');
        if (!content) {
            console.warn('GitHub repository meta tag has no content');
            return null;
        }
        
        const [username, repo, branch] = content.split(',');
        if (!username || !repo || !branch) {
            console.warn('Invalid GitHub repository meta tag format');
            return null;
        }
        
        return {
            username: username.trim(),
            repo: repo.trim(),
            branch: branch.trim()
        };
    } catch (error) {
        console.error('Error extracting GitHub repository information:', error);
        return null;
    }
}

/**
 * Creates a GitHub URL from the repository information
 * @param {string} path - Optional path within the repository (e.g., 'issues', 'blob/main/README.md')
 * @returns {string|null} GitHub URL or null if repository info not available
 */
function getGithubUrl(path = '') {
    const repoInfo = getGithubRepoInfo();
    if (!repoInfo) {
        return null;
    }
    
    const baseUrl = `https://github.com/${repoInfo.username}/${repoInfo.repo}`;
    if (path) {
        return `${baseUrl}/${path}`;
    }
    return baseUrl;
}

/**
 * Gets the GitHub URL for the current branch
 * @returns {string|null} GitHub branch URL or null if repository info not available
 */
function getCurrentBranchUrl() {
    const repoInfo = getGithubRepoInfo();
    if (!repoInfo) {
        return null;
    }
    
    return `https://github.com/${repoInfo.username}/${repoInfo.repo}/tree/${repoInfo.branch}`;
}

/**
 * Populates the repository information in the settings menu
 * This function is called when the page loads to display repo info
 */
function populateRepoInfoInSettings() {
    const repoInfo = getGithubRepoInfo();
    
    // Get DOM elements for repository info display
    const accountElement = document.getElementById('repo-account');
    const nameElement = document.getElementById('repo-name');
    const branchElement = document.getElementById('repo-branch');
    const urlElement = document.getElementById('repo-url');
    
    if (!accountElement || !nameElement || !branchElement || !urlElement) {
        console.warn('Repository info elements not found in settings menu');
        return;
    }
    
    if (repoInfo) {
        // Populate the information
        accountElement.textContent = repoInfo.username;
        nameElement.textContent = repoInfo.repo;
        branchElement.textContent = repoInfo.branch;
        
        // Set up the GitHub link
        const repoUrl = getGithubUrl();
        if (repoUrl) {
            urlElement.href = repoUrl;
            urlElement.style.display = 'inline-block';
        } else {
            urlElement.style.display = 'none';
        }
    } else {
        // Handle case where no repository info is available
        accountElement.textContent = 'Not available';
        nameElement.textContent = 'Not available';
        branchElement.textContent = 'Not available';
        urlElement.style.display = 'none';
    }
}

// Initialize repository info when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    populateRepoInfoInSettings();
});

// Make functions available globally if not using modules
if (typeof window !== 'undefined') {
    window.getGithubRepoInfo = getGithubRepoInfo;
    window.getGithubUrl = getGithubUrl;
    window.getCurrentBranchUrl = getCurrentBranchUrl;
    window.populateRepoInfoInSettings = populateRepoInfoInSettings;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getGithubRepoInfo,
        getGithubUrl,
        getCurrentBranchUrl
    };
}
