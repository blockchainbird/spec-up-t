const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

/**
 * Adds scripts to the package.json file.
 * 
 * @param {Object} scriptKeys - An object containing the scripts to add.
 * @param {Object} [overwriteKeys={}] - An object specifying which scripts to overwrite if they already exist.
 */
function addScriptsKeys(scriptKeys, overwriteKeys = {}) {
    // Use process.cwd() to get the current working directory where the command is run
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');


    // Read the package.json file
    fs.readFile(packageJsonPath, 'utf8', (err, data) => {
        if (err) {
            Logger.error('Error reading package.json:', err);
            return;
        }

        try {
            // Parse the package.json content
            const packageJson = JSON.parse(data);

            // Initialize the scripts section if it doesn't exist
            if (!packageJson.scripts) {
                packageJson.scripts = {};
            }

            // Add new scripts without overwriting existing ones unless specified in overwriteKeys
            for (const [key, value] of Object.entries(scriptKeys)) {
                if (!packageJson.scripts[key] || overwriteKeys[key]) {
                    packageJson.scripts[key] = value;
                }
            }

            // Write the updated package.json back to disk
            fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8', (err) => {
                if (err) {
                    Logger.error('Error writing package.json:', err);
                } else {
                    Logger.success('Scripts added to package.json successfully!');
                }
            });
        } catch (parseError) {
            Logger.error('Error parsing package.json:', parseError);
        }
    });
}

// Export the function
module.exports = addScriptsKeys;

/*

// Example usage:
const configScriptsKeys = {  ...  };
const overwriteConfig = { "edit": true }; // Overwrite only "edit" script

addScriptsKeys(configScriptsKeys); // Do not overwrite any existing scripts

addScriptsKeys(configScriptsKeys, overwriteConfig);  // Overwrite specified existing scripts 

*/