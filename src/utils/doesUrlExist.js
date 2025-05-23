const axios = require('axios');

/**
 * Checks if a URL returns a 200 status code.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} - True if the URL exists (200), false otherwise.
 */
async function doesUrlExist(url) {
    try {
        const response = await axios.head(url, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        // Handle specific error cases for better logging/debugging
        if (error.response && error.response.status === 404) {
            console.debug('URL does not exist:', url);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED') {
            console.debug('Network issues with URL:', url);
        } else {
            console.debug('Failed to check URL:', url, error.message);
        }
        return false;
    }
}

module.exports = { doesUrlExist };
