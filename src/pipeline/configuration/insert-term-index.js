/**
  * Inserts term index into the specification.
 *
 * This function reads the entries from term-index.json,
 * processes the term directories, and updates the specification with the term index.
 * It modifies the markdown paths in the specification and saves the updated specification
 * to a JSON file in the output directory.
 *
 * @function
 * @name insertTermIndex
 * @returns {void}
 * @file src/pipeline/configuration/insert-term-index.js
 * @author Kor Dwarshuis
 * @version 1.0.0
 * @since 2024-09-02
 */

function insertTermIndex() {
    const fs = require('fs-extra');
    const path = require('path');
    const config = fs.readJsonSync(path.join('specs.json'));
    const terms = fs.readJsonSync(path.join('.cache', 'term-index.json'));
    const outputPathJSON = path.join('.cache', 'specs-generated.json');
    let specGenerated = config;
    let markdownPaths = specGenerated.specs[0].markdown_paths;

    // Find the index of the "terms-and-definitions-intro.md" file in the markdown paths
    const index = markdownPaths.indexOf('terms-and-definitions-intro.md');

    // 
    if (index !== -1) {
        // Insert the items of the "terms" array after the found index
        markdownPaths.splice(index + 1, 0, ...terms);
    }

    // Save the updated specGenerated object back to the JSON file
    fs.writeJsonSync(outputPathJSON, specGenerated, { spaces: 2 });

    // Create directory named “.cache” in the project root if it does not yet exist
    if (!fs.existsSync('.cache')) {
        fs.mkdirSync('.cache');
    }

    fs.writeJsonSync(outputPathJSON, specGenerated, { spaces: 2 });
}

module.exports = {
    insertTermIndex
}