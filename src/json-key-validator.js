/**
 * @file json-key-validator.js
 * @description This script validates the presence of required keys in a JSON object loaded from 'specs.json'.
 * It uses synchronous methods to read the file and check the keys. If any required key is missing, it logs an error.
 * The script pauses execution and waits for the user to press ENTER before continuing.
 * 
 * @requires fs - File system module to read the JSON file.
 * @requires readline-sync - Module to pause the script and wait for user input.
 */

const fs = require('fs');
const readlineSync = require('readline-sync');
const Logger = require('./utils/logger');

let errorFound = false;

// Function to pause the script and wait for the ENTER key synchronously
function pauseForEnterSync() {
    readlineSync.question('Press ENTER to continue...');
}

// Load the JSON data from the 'specs.json' file
function loadData() {
    return JSON.parse(fs.readFileSync('./specs.json', 'utf8'));
}

// This function recursively checks if the required keys are present in the object
function checkKeysSync(object, expectedKeys, parentKey = '') {
    // Guard against undefined or non-iterable expected key definitions so the validator fails gracefully instead of throwing.
    if (!Array.isArray(expectedKeys)) {
        return;
    }

    for (let key of expectedKeys) {
        if (Array.isArray(object)) {
            // If the object is an array, check each item within the array
            for (let [index, item] of object.entries()) {
                checkKeysSync(item, expectedKeys, `${parentKey}[${index}]`);
            }
        } else if (typeof object === 'object') {
            // If the key is missing from the object, log an error
            if (!(key in object)) {
                Logger.error(`Error: Missing key '${key}'\n   We cannot guarantee that Spec-Up-T will work properly.\n   Here is an example specs.json file:\n   https://github.com/trustoverip/spec-up-t-starter-pack/blob/main/spec-up-t-boilerplate/specs.json`);
                errorFound = true;
                pauseForEnterSync(); // Pause synchronously to allow user to acknowledge the error
            }
            // If the expected key contains nested objects, recursively check for them
            if (typeof expectedKeys[key] === 'object' && object[key]) {
                checkKeysSync(object[key], expectedKeys[key], `${parentKey}.${key}`);
            }
        }
    }
}

// Main function that runs the validator script
function runJsonKeyValidatorSync() {
    const data = loadData(); // Load the JSON file data

    // Define the keys expected in the JSON structure
    const expectedKeys = {
        specs: [
            "title",
            "spec_directory",
            "spec_terms_directory",
            "output_path",
            "markdown_paths",
            "logo",
            "logo_link",
            "source",
            // "external_specs"
            // "assets"  // Commented out: We no longer check for 'assets' in the specs object
        ],
        source: [
            "host",
            "account",
            "repo"
        ],
        // external_specs: [
        //     "gh_page",
        //     "external_spec",
        //     "url",
        //     "terms_dir"
        // ],
        // Removed the 'assets' block entirely, as it's no longer part of the required keys:
        // assets: [
        //     "path",
        //     "inject",
        //     "module"
        // ]
    };

    // Iterate over each spec entry in the specs array from the JSON file
    for (let [index, spec] of data.specs.entries()) {
        Logger.info(`Checking spec #${index + 1}`);

        // Check for keys defined in expectedKeys.specs
        checkKeysSync(spec, expectedKeys.specs, `specs[${index}]`);

        // Check for keys inside the 'source' object, if present
        if (spec.source) {
            checkKeysSync(spec.source, expectedKeys.source, `specs[${index}].source`);
        }

        // Check for keys inside the 'external_specs' array, if present
        if (spec.external_specs && Array.isArray(expectedKeys.external_specs)) {
            checkKeysSync(spec.external_specs, expectedKeys.external_specs, `specs[${index}].external_specs`);
        }

        // The assets check is no longer necessary and has been commented out
        // if (spec.assets) {
        //     checkKeysSync(spec.assets, expectedKeys.assets, `specs[${index}].assets`);
        // }
    }

    // If no errors were found, print a success message
    if (!errorFound) {
        Logger.success('All keys are present. No errors found. Continuing…');
    }
}

// Export the function to be used in other scripts
module.exports = {
    runJsonKeyValidatorSync
};
