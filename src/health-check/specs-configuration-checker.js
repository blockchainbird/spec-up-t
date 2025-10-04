/**
 * @fileoverview Spec-Up-T specs.json Configuration Validator
 * 
 * Validates specs.json configuration files by comparing project configurations
 * against default templates to ensure proper setup and catch common issues.
 * 
 * **Validation Flow:**
 * 1. File existence check (project specs.json + default template)
 * 2. Field categorization (required vs optional fields)
 * 3. Required field validation (presence + configuration status)
 * 4. Optional field validation (configuration warnings)
 * 5. Unexpected field detection (typo prevention)
 * 6. Summary report generation
 * 
 * **Field Categories:**
 * - **Required fields**: Must be present (e.g., title, author, source)
 * - **Optional fields**: Can be omitted (e.g., logo, external_specs)
 * - **Must-change fields**: Cannot use default values (title, author, etc.)
 * - **Allow-default fields**: Can keep default values (spec_directory, etc.)
 * - **Deprecated fields**: Legacy fields ignored during validation
 * 
 * **Output:**
 * Returns structured validation results with pass/fail/warning status,
 * detailed messages, and actionable feedback for configuration improvements.
 * 
 * @author Spec-Up-T Team
 * @since 2025-06-06
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

/**
 * Field descriptions for specs.json keys
 */
const fieldDescriptions = {
    'title': 'Specification title',
    'description': 'Specification description',
    'author': 'Specification author',
    'source': 'Source repository information',
    'spec_directory': 'Directory containing specification content',
    'spec_terms_directory': 'Directory containing term definitions',
    'output_path': 'Output directory for generated files',
    'markdown_paths': 'List of markdown files to include in the specification',
    'logo': 'Logo URL',
    'logo_link': 'Link to the logo',
    'favicon': 'Favicon URL',
    'external_specs': 'External specifications',
    'katex': 'KaTeX math rendering configuration'
};

/**
 * Fields that can remain at their default values without being flagged
 */
const allowDefaultValueFields = [
    'spec_directory',
    'spec_terms_directory',
    'output_path',
    'katex',
    'logo',
    'logo_link',
    'favicon'
];

/**
 * Fields that should fail if they're not modified from default values
 */
const mustChangeFields = [
    'title',
    'description',
    'author',
    'source'
];

/**
 * Known optional fields
 */
const knownOptionalFields = [
    'logo',
    'external_specs',
    'logo_link',
    'favicon',
    'katex',
    'spec_directory',
    'spec_terms_directory',
    'output_path',
    'markdown_paths'
];

/**
 * Deprecated fields that should not be flagged as unexpected
 */
const deprecatedFields = [];

/**
 * Check if the files needed for configuration check exist
 * @param {string} projectSpecsPath - Path to project specs.json
 * @param {string} defaultSpecsPath - Path to default specs.json
 * @returns {Array|null} - Check results or null if files exist
 */
function checkFilesExist(projectSpecsPath, defaultSpecsPath) {
    if (!fs.existsSync(projectSpecsPath)) {
        return [{
            name: 'Find specs.json file',
            success: false,
            details: 'specs.json file not found in project root'
        }];
    }

    if (!fs.existsSync(defaultSpecsPath)) {
        return [{
            name: 'Find default specs.json template',
            success: false,
            details: 'Default specs.json template not found'
        }];
    }

    return null;
}

/**
 * Get all valid field names (required + optional + deprecated). Creates a comprehensive list of all field names that should not be flagged as "unexpected"
 * @param {Array} defaultSpecKeys - Keys from default specs
 * @returns {Array} - All valid field names
 */
function getAllValidFields(defaultSpecKeys) {
    // Get all field names from descriptions (these are the canonical field names)
    const canonicalFields = Object.keys(fieldDescriptions);
    
    // Combine with known optional fields and deprecated fields
    const allValidFields = [
        ...canonicalFields,
        ...knownOptionalFields,
        ...deprecatedFields,
        ...defaultSpecKeys
    ];
    
    // Remove duplicates
    return [...new Set(allValidFields)];
}

/**
 * Categorize fields into required and optional
 * @param {Array} defaultSpecKeys - Keys from default specs
 * @returns {Object} - Object containing required and optional fields
 */
function categorizeFields(defaultSpecKeys) {
    const createFieldObject = key => ({
        key,
        description: fieldDescriptions[key] || `${key.replace(/_/g, ' ')} field`,
        allowDefaultValue: allowDefaultValueFields.includes(key),
        mustChange: mustChangeFields.includes(key)
    });

    const requiredFields = defaultSpecKeys
        .filter(key => !knownOptionalFields.includes(key))
        .map(createFieldObject);

    const optionalFields = defaultSpecKeys
        .filter(key => knownOptionalFields.includes(key))
        .map(createFieldObject);

    return { requiredFields, optionalFields };
}

/**
 * Process field validation results. Orchestrates the validation of all fields in the specs.json
 * @param {Object} projectSpecs - Project specs object  
 * @param {Object} defaultSpecs - Default specs object
 * @param {Array} defaultSpecKeys - Keys from default specs
 * @returns {Object} - Object with results and missingRequiredKeys
 */
function processFieldValidation(projectSpecs, defaultSpecs, defaultSpecKeys) {
    const { requiredFields, optionalFields } = categorizeFields(defaultSpecKeys);
    
    const requiredResults = requiredFields.map(field => evaluateRequiredField(field, projectSpecs, defaultSpecs));
    const optionalResults = optionalFields.map(field => evaluateOptionalField(field, projectSpecs, defaultSpecs));
    
    const missingRequiredKeys = requiredResults
        .filter(result => !result.success && result.details.includes('missing'))
        .map((_, index) => requiredFields[index].key);
    
    return { 
        results: [...requiredResults, ...optionalResults], 
        missingRequiredKeys 
    };
}

/**
 * Check for unexpected fields in project specs
 * @param {Object} projectSpecs - Project specs object
 * @param {Array} defaultSpecKeys - Keys from default specs
 * @returns {Array} - Array of unexpected field names
 */
function findUnexpectedFields(projectSpecs, defaultSpecKeys) {
    const projectKeys = Object.keys(projectSpecs.specs?.[0] || {});
    const allValidFields = getAllValidFields(defaultSpecKeys);
    
    return projectKeys.filter(key => !allValidFields.includes(key));
}

/**
 * Check if a field value has been configured
 * @param {any} projectValue - Value from project specs
 * @param {any} defaultValue - Value from default specs
 * @returns {boolean} - True if configured
 */
function isFieldConfigured(projectValue, defaultValue) {
    if (typeof projectValue === 'object') {
        return JSON.stringify(projectValue) !== JSON.stringify(defaultValue);
    }
    return projectValue !== defaultValue;
}

/**
 * Evaluate a field and generate result (unified for required/optional)
 * @param {Object} field - Field definition
 * @param {Object} projectSpecs - Project specs object
 * @param {Object} defaultSpecs - Default specs object
 * @param {boolean} isRequired - Whether field is required
 * @returns {Object} - Check result
 */
function evaluateField(field, projectSpecs, defaultSpecs, isRequired) {
    const hasField = projectSpecs.specs?.[0]?.hasOwnProperty(field.key);
    
    if (!hasField) {
        return {
            name: `${field.description} configuration`,
            success: !isRequired,
            details: isRequired 
                ? `Required "${field.key}" key is missing in specs.json`
                : `Optional "${field.key}" key is not present (this is not required)`
        };
    }

    const projectValue = projectSpecs.specs[0][field.key];
    const defaultValue = defaultSpecs.specs?.[0]?.[field.key];
    const isConfigured = field.allowDefaultValue || isFieldConfigured(projectValue, defaultValue);
    
    // Show warning when fields haven't been configured from their default values
    const status = isConfigured ? undefined : 'warning';
    
    const details = isConfigured
        ? (projectValue === defaultValue && field.allowDefaultValue)
            ? `Default value for ${field.description} is acceptable`
            : `${field.description} has been changed from default`
        : `${field.description} is still set to default value${mustChangeFields.includes(field.key) ? `: \"${defaultValue}\"` : ''}`;

    return {
        name: `${field.description} configuration`,
        status,
        success: true,
        details
    };
}

/**
 * Evaluate a required field and generate result
 * @param {Object} field - Field definition
 * @param {Object} projectSpecs - Project specs object
 * @param {Object} defaultSpecs - Default specs object
 * @returns {Object} - Check result
 */
function evaluateRequiredField(field, projectSpecs, defaultSpecs) {
    return evaluateField(field, projectSpecs, defaultSpecs, true);
}

/**
 * Evaluate an optional field and generate result
 * @param {Object} field - Field definition
 * @param {Object} projectSpecs - Project specs object
 * @param {Object} defaultSpecs - Default specs object
 * @returns {Object} - Check result
 */
function evaluateOptionalField(field, projectSpecs, defaultSpecs) {
    return evaluateField(field, projectSpecs, defaultSpecs, false);
}

/**
 * Generate summary results for the configuration check
 * @param {Array} results - Existing check results
 * @param {Array} missingRequiredKeys - List of missing required keys
 * @param {Array} unexpectedKeys - List of unexpected keys
 * @returns {Array} - Additional summary results
 */
function generateSummaryResults(results, missingRequiredKeys, unexpectedKeys) {
    const summaryResults = [];
    
    // Required fields summary
    summaryResults.push({
        name: 'Required fields check',
        success: missingRequiredKeys.length === 0,
        details: missingRequiredKeys.length > 0 
            ? `Missing required fields: ${missingRequiredKeys.join(', ')}`
            : 'All required fields are present'
    });

    // Unexpected fields check
    if (unexpectedKeys.length > 0) {
        summaryResults.push({
            name: 'Unexpected fields check',
            success: false,
            details: `Found unexpected fields that might be typos: ${unexpectedKeys.join(', ')}`
        });
    }

    // Overall configuration status
    const fieldResults = results.filter(r => 
        r.name.includes('configuration') && !r.name.includes('Overall')
    );
    
    const configuredItemsCount = fieldResults.filter(r => r.success).length;
    const configurationPercentage = Math.round((configuredItemsCount / fieldResults.length) * 100);

    summaryResults.push({
        name: 'Overall configuration status',
        success: configurationPercentage > 50 && missingRequiredKeys.length === 0,
        details: `${configurationPercentage}% of specs.json has been configured (${configuredItemsCount}/${fieldResults.length} items)`
    });

    return summaryResults;
}

/**
 * Load and parse configuration files
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - Object containing parsed specs and file paths
 */
function loadConfigurationFiles(projectRoot) {
    const projectSpecsPath = path.join(projectRoot, 'specs.json');
    const defaultSpecsPath = path.join(
        __dirname, '..', 'install-from-boilerplate', 'boilerplate', 'specs.json'
    );

    const fileCheckResults = checkFilesExist(projectSpecsPath, defaultSpecsPath);
    if (fileCheckResults) {
        return { error: fileCheckResults };
    }

    const projectSpecs = JSON.parse(fs.readFileSync(projectSpecsPath, 'utf8'));
    const defaultSpecs = JSON.parse(fs.readFileSync(defaultSpecsPath, 'utf8'));
    
    return { projectSpecs, defaultSpecs };
}

/**
 * Check if specs.json has been configured from default
 * @param {string} projectRoot - Root directory of the project
 * @returns {Promise<Array>} - Array of check results
 */
async function checkSpecsJsonConfiguration(projectRoot) {
    try {
        const { error, projectSpecs, defaultSpecs } = loadConfigurationFiles(projectRoot);
        if (error) return error;

        const results = [{
            name: 'specs.json exists',
            success: true,
            details: 'Project specs.json file found'
        }];

        const defaultSpecKeys = Object.keys(defaultSpecs.specs?.[0] || {});
        const { results: fieldResults, missingRequiredKeys } = processFieldValidation(
            projectSpecs, defaultSpecs, defaultSpecKeys
        );
        
        results.push(...fieldResults);
        
        const unexpectedKeys = findUnexpectedFields(projectSpecs, defaultSpecKeys);
        const summaryResults = generateSummaryResults(results, missingRequiredKeys, unexpectedKeys);
        
        return [...results, ...summaryResults];

    } catch (error) {
        Logger.error('Error checking specs.json configuration:', error);
        return [{
            name: 'specs.json configuration check',
            success: false,
            details: `Error: ${error.message}`
        }];
    }
}

module.exports = {
    checkSpecsJsonConfiguration
};