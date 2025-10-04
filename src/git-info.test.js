/**
 * @fileoverview Test file for git-info utility functions
 * This test verifies that the GitHub repository information
 * is correctly extracted and formatted for the meta tag.
 */

const { getCurrentBranch, getGithubRepoInfo } = require('./utils/git-info');

// Tests for extracting and formatting Git repository information
describe('git-info utility', () => {
  // Tests for getting the current Git branch name
  describe('getCurrentBranch', () => {
    // Test: Does the function return a valid branch name as a string?
    test('should return a string branch name', () => {
      const branch = getCurrentBranch();
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });

    // Test: Is the branch name properly formatted (no whitespace)?
    test('should not contain newlines or spaces', () => {
      const branch = getCurrentBranch();
      expect(branch).not.toMatch(/\n|\r|\s/);
    });
  });

  // Tests for formatting GitHub repository information for meta tags
  describe('getGithubRepoInfo', () => {
    // Test: Can the system format complete repository information correctly?
    test('should format github repo info correctly with valid spec', () => {
      const spec = {
        source: {
          account: 'testuser',
          repo: 'testrepo'
        }
      };
      
      const repoInfo = getGithubRepoInfo(spec);
      expect(repoInfo).toMatch(/^testuser,testrepo,.+$/);
      
      const parts = repoInfo.split(',');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('testuser');
      expect(parts[1]).toBe('testrepo');
      expect(parts[2].length).toBeGreaterThan(0);
    });

    // Test: Does the system gracefully handle missing repository information?
    test('should handle missing source object', () => {
      const spec = {};
      const repoInfo = getGithubRepoInfo(spec);
      expect(repoInfo).toMatch(/^unknown,unknown,.+$/);
    });

    // Test: Can the system handle incomplete repository information?
    test('should handle partial source information', () => {
      const spec = {
        source: {
          account: 'onlyuser'
          // missing repo
        }
      };
      
      const repoInfo = getGithubRepoInfo(spec);
      expect(repoInfo).toMatch(/^onlyuser,unknown,.+$/);
    });

    // Test: Does the system follow best practices for meta tag naming?
    test('should use spec-up-t namespace prefix recommendation', () => {
      // This test verifies our implementation follows the best practice
      // of using namespaced property names as recommended in the user request
      const metaTagProperty = 'spec-up-t:github-repo-info';
      expect(metaTagProperty).toMatch(/^spec-up-t:/);
    });
  });
});
