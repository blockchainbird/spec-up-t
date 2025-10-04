/**
 * Interactive configurator for the Spec-Up-T starter pack.
 *
 * The module collects starter metadata from the user, updates the first
 * spec entry in `specs.json`, and persists the changes. It can be required
 * programmatically or executed directly from the command line.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const Logger = require('../../utils/logger');

const SPECS_KEY = 'specs';
const JSON_FILE_PATH = path.resolve(process.cwd(), 'specs.json');

const defaultQuestions = [
    { field: 'title', prompt: 'Enter title', defaultValue: 'Spec-Up-T Starterpack' },
    { field: 'description', prompt: 'Enter description', defaultValue: 'Create technical specifications in markdown. Based on the original Spec-Up, extended with Terminology tooling' },
    { field: 'author', prompt: 'Enter author', defaultValue: 'Trust over IP Foundation' },
    { field: 'account', prompt: 'Enter account', defaultValue: 'trustoverip' },
    { field: 'repo', prompt: 'Enter repo', defaultValue: 'spec-up-t-starter-pack' }
];

/**
 * Verifies that the specs.json file exists before prompting the user.
 */
function assertSpecsFileExists() {
    if (fs.existsSync(JSON_FILE_PATH)) {
        return;
    }

    Logger.error(`Error: ${JSON_FILE_PATH} does not exist.`);
    process.exit(1);
}

/**
 * Reads and parses the specs.json file, providing helpful feedback on failure.
 *
 * @returns {object} Parsed JSON contents.
 */
function loadSpecsConfig() {
    try {
        return JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
    } catch (error) {
        Logger.error(`Error: Could not parse ${JSON_FILE_PATH}.`, error.message);
        process.exit(1);
    }
}

/**
 * Ensures the first spec entry exists and returns it for updates. Exits when the
 * structure is malformed because continuing would corrupt the file.
 *
 * @param {object} config - Parsed configuration object from specs.json.
 * @returns {{ config: object, primarySpec: object }} The config and its first spec entry.
 */
function resolvePrimarySpec(config) {
    const specs = config[SPECS_KEY];

    if (!Array.isArray(specs) || specs.length === 0 || !specs[0]) {
        Logger.error(`Error: Invalid JSON structure. "${SPECS_KEY}[0]" is missing.`);
        process.exit(1);
    }

    return { config, primarySpec: specs[0] };
}

/**
 * Builds the prompt text with the default value appended for clarity.
 *
 * @param {string} label - Question label displayed to the user.
 * @param {string} defaultValue - Value shown as default.
 * @returns {string} Prompt string formatted for readline.
 */
function formatPrompt(label, defaultValue) {
    return `${label} (${defaultValue}): `;
}

/**
 * Collects answers for all configuration questions from stdin/stdout.
 *
 * @param {Array<{ field: string, prompt: string, defaultValue: string }>} questions - Questions to ask.
 * @param {NodeJS.ReadableStream} input - Input stream for readline.
 * @param {NodeJS.WritableStream} output - Output stream for readline.
 * @returns {Promise<object>} Map of field names to user answers.
 */
function promptForAnswers(questions, input, output) {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({ input, output });
        const answers = {};
        let index = 0;

        const askNext = () => {
            if (index >= questions.length) {
                rl.close();
                resolve(answers);
                return;
            }

            const { field, prompt, defaultValue } = questions[index];
            rl.question(formatPrompt(prompt, defaultValue), answer => {
                answers[field] = answer ? answer.trim() : defaultValue;
                index += 1;
                askNext();
            });
        };

        rl.on('error', error => {
            rl.close();
            reject(error);
        });

        askNext();
    });
}

/**
 * Applies the collected answers to the spec configuration, keeping nested
 * `source` fields isolated from top-level metadata.
 *
 * @param {object} primarySpec - The spec entry to mutate.
 * @param {object} answers - User responses keyed by field.
 */
function applyAnswersToSpec(primarySpec, answers) {
    if (!primarySpec.source) {
        primarySpec.source = {};
    }

    Object.entries(answers).forEach(([field, value]) => {
        if (['account', 'repo'].includes(field)) {
            primarySpec.source[field] = value;
            return;
        }

        primarySpec[field] = value;
    });
}

/**
 * Persists the updated configuration back to specs.json.
 *
 * @param {object} config - Configuration object with modifications applied.
 */
function persistUpdatedConfig(config) {
    try {
        fs.writeFileSync(JSON_FILE_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
        Logger.success(`Successfully updated ${JSON_FILE_PATH}.`);
    } catch (error) {
        Logger.error(`Error: Could not update ${JSON_FILE_PATH}.`, error.message);
        process.exit(1);
    }
}

/**
 * Runs the interactive configuration workflow.
 *
 * @param {object} [options]
 * @param {Array} [options.questions] - Override the default question set.
 * @param {NodeJS.ReadableStream} [options.input] - Custom input stream for testing.
 * @param {NodeJS.WritableStream} [options.output] - Custom output stream for testing.
 * @returns {Promise<void>}
 */
async function runStarterpackConfigurator({
    questions = defaultQuestions,
    input = process.stdin,
    output = process.stdout
} = {}) {
    assertSpecsFileExists();

    Logger.info(`\nWelcome to the Spec-Up-T Starterpack configuration tool!\n` +
        '\nYou will be asked a series of questions to customize your project.\n' +
        "Here’s what each field means:\n" +
        '- "Title": The name of your project.\n' +
        '- "Description": A brief explanation of your project.\n' +
        '- "Author": The name of the person or organization creating the project.\n' +
        '- "Account": The GitHub account or organization where the repository will be hosted.\n' +
        '- "Repo": The name of the GitHub repository.\n\n' +
        'Press Enter to accept the default value shown in parentheses.\n'
    );

    try {
        const answers = await promptForAnswers(questions, input, output);
        const { config, primarySpec } = resolvePrimarySpec(loadSpecsConfig());
        applyAnswersToSpec(primarySpec, answers);
        persistUpdatedConfig(config);
    } catch (error) {
        Logger.error('Configuration aborted due to an unexpected error.', error.message);
        process.exit(1);
    }
}

if (process.env.SPEC_UP_T_CONFIGURATOR_AUTORUN !== 'false') {
    runStarterpackConfigurator();
}

module.exports = {
    runStarterpackConfigurator
};
