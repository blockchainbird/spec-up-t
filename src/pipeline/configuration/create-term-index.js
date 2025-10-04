/**
 * Steps:
 * 1. Reads the configuration from 'specs.json', with fallbacks for missing or invalid files.
 * 2. Extracts the directories containing the specifications and terms, with defaults for missing values.
 * 3. Lists all file names in the specified terms directory if it exists.
 * 4. Joins each file name with the terms directory path.
 * 5. Creates an '.cache' directory in the project root if it does not exist.
 * 6. Writes the list of file paths to 'term-index.json' in the project root.
 *
 * If any errors occur during the process, appropriate warnings are logged, and an empty term index
 * will be created rather than throwing fatal errors.
 *
 * @requires fs-extra - File system operations with extra methods.
 * @requires path - Utilities for working with file and directory paths.
 * @file src/pipeline/configuration/create-term-index.js
 * @author Kor Dwarshuis
 * @version 1.1.0
 * @since 2024-09-02
 */

const { shouldProcessFile } = require('../../utils/file-filter.js');
const Logger = require('../../utils/logger.js');

function createTermIndex() {
    try {
        const fs = require('fs-extra');
        const path = require('path');
        const configPath = 'specs.json';
        
        // Check if specs.json exists
        if (!fs.existsSync(configPath)) {
            Logger.warn(`Config file '${configPath}' not found. Using default configuration.`);
            var config = { specs: [] };
        } else {
            // Read config with try-catch to handle parsing errors
            try {
                var config = fs.readJsonSync(configPath);
            } catch (readError) {
                Logger.warn(`Error reading config file: ${readError.message}. Using default configuration.`);
                var config = { specs: [] };
            }
        }
        
        // Provide defaults for missing config
        if (!config) {
            Logger.warn('Config file is empty or invalid. Using defaults.');
            config = { specs: [] };
        }
        
        if (!config.specs) {
            Logger.warn('No specs array found in config. Creating empty specs array.');
            config.specs = [];
        } else if (!Array.isArray(config.specs)) {
            Logger.warn('Config specs is not an array. Converting to array.');
            config.specs = [config.specs]; // Convert to array if it's an object
        }
        
        // If no valid specs, create an empty term index
        if (config.specs.length === 0) {
            Logger.warn('No specs found in configuration. Creating an empty term index.');
        }
        
        // Extract spec directories with fallback to current directory
        const specDirectories = config.specs.map((spec, index) => {
            if (!spec.spec_directory) {
                Logger.warn(`spec_directory missing in specs.json entry #${index + 1}. Using current directory.`);
                return '.';  // Default to current directory
            }
            return spec.spec_directory;
        });
        
        // Extract term directories with fallback to default value
        const specTermDirectoryName = config.specs.map((spec, index) => {
            if (!spec.spec_terms_directory) {
                Logger.warn(`spec_terms_directory missing in specs.json entry #${index + 1}. Using default 'terms' directory.`);
                return 'terms'; // Default directory name for terms
            }
            return spec.spec_terms_directory;
        });
        
        // Safety check - if we have no valid entries, warn and exit cleanly
        if (specDirectories.length === 0 || specTermDirectoryName.length === 0) {
            Logger.info('No term directories found in configuration. Creating empty term index.');
            
            // Create an empty term index
            const outputPathJSON = path.join('.cache', 'term-index.json');
            if (!fs.existsSync('.cache')) {
                fs.mkdirSync('.cache', { recursive: true });
            }
            fs.writeJsonSync(outputPathJSON, [], { spaces: 2 });
            Logger.success(`Empty term index created at: ${outputPathJSON}`);
            return; // Exit function early
        }
        
        // Verify that the base spec directory exists
        const baseSpecDir = specDirectories[0];
        if (!baseSpecDir || !fs.existsSync(baseSpecDir)) {
            Logger.warn(`Spec directory '${baseSpecDir}' does not exist. Creating empty term index.`);
            
            // Create an empty term index
            const outputPathJSON = path.join('.cache', 'term-index.json');
            if (!fs.existsSync('.cache')) {
                fs.mkdirSync('.cache', { recursive: true });
            }
            fs.writeJsonSync(outputPathJSON, [], { spaces: 2 });
            Logger.success(`Empty term index created at: ${outputPathJSON}`);
            return; // Exit function early
        }
        
        // Verify that the terms directory exists
        const termsDir = path.join(baseSpecDir, specTermDirectoryName[0]);
        
        let files = [];
        if (!fs.existsSync(termsDir)) {
            Logger.warn(`Terms directory '${termsDir}' does not exist. Creating an empty term index.`);
        } else {
            // Get list of files and filter them
            files = fs.readdirSync(termsDir).filter(shouldProcessFile);
        }
        
        if (files.length === 0) {
            Logger.warn('No term files found to process.');
        }
        
        const filePaths = files.map(file => specTermDirectoryName[0] + '/' + file);
        const outputPathJSON = path.join('.cache', 'term-index.json');
        
        // Create .cache directory if it doesn't exist
        if (!fs.existsSync('.cache')) {
            fs.mkdirSync('.cache', { recursive: true });
        }
        
        // Write the term index file
        try {
            fs.writeJsonSync(outputPathJSON, filePaths, { spaces: 2 });
            Logger.success(`Term index created with ${files.length} terms. Output: ${outputPathJSON}`);
        } catch (writeError) {
            throw new Error(`Failed to write term index file: ${writeError.message}`);
        }
    } catch (error) {
        Logger.error(`Error creating term index: ${error.message}`);
        throw error;
    }
}

module.exports = {
    createTermIndex
}