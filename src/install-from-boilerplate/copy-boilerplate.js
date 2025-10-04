const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger');

function copyBoilerplate() {
    const sourceDir = path.join(__dirname, './', 'boilerplate');
    const items = fs.readdirSync(sourceDir);
    items.forEach(item => {
        const srcPath = path.join(sourceDir, item);
        // Root of the project
        const destPath = path.join(__dirname, '../../../../', item);
        fs.cpSync(srcPath, destPath, { recursive: true });
    });

    // Rename the copied gitignore file to .gitignore
    const gitignorePath = path.join(__dirname, '../../../../', 'gitignore');
    const gitignoreDestPath = path.join(__dirname, '../../../../', '.gitignore');
    fs.renameSync(gitignorePath, gitignoreDestPath);

    Logger.success('Copied spec-up-t-boilerplate to current directory');
}

module.exports = copyBoilerplate;