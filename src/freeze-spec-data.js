/**
 * @file freeze-spec-data.js
 * @description Reads the output path from specs.json, finds the highest versioned directory
 * in the destination path, and copies index.html to a new directory with an incremented version.
 * The user is prompted for a human-readable label for the snapshot; the label is persisted in
 * versions/labels.json so that create-versions-index.js can use it as link text.
 */

const fs = require('fs-extra');
const path = require('node:path');
const readline = require('node:readline');
const Logger = require('./utils/logger');
const { versions } = require('./utils/regex-patterns');

const config = fs.readJsonSync('specs.json');
const outputPath = config.specs[0].output_path;

const sourceFile = path.join(outputPath, 'index.html');

// snapshots/ lives at the repo root and is committed to the main branch.
// This is the source of truth — it survives gh-pages resets and fresh CI checkouts.
// docs/versions/ is the derived, deployed copy and is always rebuilt from here.
const destDir = 'snapshots';

// A snapshot can only be created when the specification has been built at least once.
// If index.html is missing, the user must render the spec first (`npm run menu 1`).
if (!fs.existsSync(sourceFile)) {
    Logger.error(
        `Cannot create a snapshot: "${sourceFile}" does not exist.\n` +
        `Please build the specification first (e.g. npm run menu 1) and try again.`
    );
    process.exit(0);
}

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const dirs = fs.readdirSync(destDir).filter(file => fs.statSync(path.join(destDir, file)).isDirectory());
let highestVersion = 0;
const versionPattern = versions.pattern;

dirs.forEach(dir => {
    const match = dir.match(versionPattern);
    if (match) {
        const version = parseInt(match[1], 10);
        if (version > highestVersion) {
            highestVersion = version;
        }
    }
});

const newVersion = highestVersion + 1;
const newVersionDir = path.join(destDir, `v${newVersion}`);
const defaultLabel = `v${newVersion}`;

/**
 * Prompts the user for a single line of input, showing a default value.
 * Pressing Enter without typing accepts the default.
 * @param {string} question - The question text shown to the user.
 * @param {string} defaultValue - The value used when the user presses Enter without typing.
 * @returns {Promise<string>}
 */
function prompt(question, defaultValue) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(`${question} [${defaultValue}]: `, answer => {
            rl.close();
            resolve(answer.trim() || defaultValue);
        });
    });
}

/**
 * Persists the label for the given directory name in versions/labels.json.
 * Existing entries are preserved; only the new key is added or updated.
 * @param {string} labelsFile - Absolute path to labels.json.
 * @param {string} dirName - The version directory name (e.g. "v3").
 * @param {string} label - The human-readable label to store.
 */
function saveLabel(labelsFile, dirName, label) {
    const existing = fs.existsSync(labelsFile) ? fs.readJsonSync(labelsFile) : {};
    existing[dirName] = label;
    fs.writeJsonSync(labelsFile, existing, { spaces: 2 });
}

/**
 * Main flow: resolve the label, create the version directory, copy the snapshot,
 * save the label, and regenerate the versions index.
 *
 * Label resolution order:
 *  1. FREEZE_LABEL environment variable — set by the menu.yml GitHub Actions workflow
 *     so that GitHubUi (or any non-interactive caller) can supply a custom label.
 *  2. Interactive readline prompt — only used when stdin is a real TTY (local CLI).
 *  3. Default label (e.g. "v3") — fallback for non-interactive environments without
 *     an explicit FREEZE_LABEL (e.g. running freeze directly inside a CI script).
 */
async function run() {
    let label;

    if (process.env.FREEZE_LABEL) {
        // Non-interactive path: label supplied by caller via environment variable
        label = process.env.FREEZE_LABEL;
    } else if (process.stdin.isTTY) {
        // Interactive path: prompt the user, defaulting to the auto-generated name
        label = await prompt('Enter a label for this snapshot', defaultLabel);
    } else {
        // Non-interactive path without an explicit label: use the auto-generated default
        label = defaultLabel;
    }

    if (!fs.existsSync(newVersionDir)) {
        fs.mkdirSync(newVersionDir, { recursive: true });
    }

    const destFile = path.join(newVersionDir, 'index.html');
    fs.copyFileSync(sourceFile, destFile);

    const labelsFile = path.join(destDir, 'labels.json');
    saveLabel(labelsFile, `v${newVersion}`, label);

    Logger.success(`Created a freezed specification version in ${destFile}`);

    // Sync snapshots/ → docs/versions/ so the local preview reflects the
    // new snapshot immediately, then regenerate the versions index page.
    const syncSnapshots = require('./pipeline/configuration/sync-snapshots.js');
    syncSnapshots(outputPath);

    const createVersionsIndex = require('./pipeline/configuration/create-versions-index.js');
    createVersionsIndex(outputPath);
}

run();
