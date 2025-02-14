const fs = require('fs-extra');
const path = require('path');
const { systemFiles } = require('./config-system-files.js');

/**
 * Copies system files from the boilerplate directory to the root of the project.
 * System files are defined in the `config-system-files.js` file.
 * Files are copied recursively and can be safely overwritten.
 */
function copySystemFiles() {
    const sourceDir = path.join(__dirname, './', 'boilerplate');

    systemFiles.forEach(item => {
        const srcPath = path.join(sourceDir, item);

        // Root of the project
        const destPath = path.join(__dirname, '../../../../', item);

        try {
            fs.cpSync(srcPath, destPath, { recursive: true });
            console.log(`✅ Copied ${item} to ${destPath}`);
        } catch (error) {
            console.error(`❌ Failed to copy ${item} to ${destPath}:`);
        }
    });

    console.log('✅ Copied system files to current directory');
}

module.exports = copySystemFiles;