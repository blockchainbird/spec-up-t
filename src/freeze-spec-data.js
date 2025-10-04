/**
 * @file freeze-spec-data.js
 * @description Reads the output path from specs.json, finds the highest versioned directory
 * in the destination path, and copies index.html to a new directory with an incremented version.
 */

const fs = require('fs-extra');
const path = require('path');
const Logger = require('./utils/logger');
const { versions } = require('./utils/regex-patterns');

const config = fs.readJsonSync('specs.json');
const outputPath = config.specs[0].output_path;

const sourceFile = path.join(outputPath, 'index.html');
const destDir = path.join(outputPath, 'versions');

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

if (!fs.existsSync(newVersionDir)) {
    fs.mkdirSync(newVersionDir, { recursive: true });
}

const destFile = path.join(newVersionDir, 'index.html');
fs.copyFileSync(sourceFile, destFile);

Logger.success(`Created a freezed specification version in ${destFile}`);
