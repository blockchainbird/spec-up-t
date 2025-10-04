const { configScriptsKeys } = require('./config-scripts-keys');
const { configOverwriteScriptsKeys } = require('./config-scripts-keys');
const addScriptsKeys = require('./add-scripts-keys');
const copySystemFiles = require('./copy-system-files');
const { gitIgnoreEntries } = require('./config-gitignore-entries');
const {updateGitignore} = require('./add-gitignore-entries');


addScriptsKeys(configScriptsKeys, configOverwriteScriptsKeys);
copySystemFiles();
updateGitignore(gitIgnoreEntries.gitignorePath, gitIgnoreEntries.filesToAdd);

const Logger = require('../utils/logger');

// We can use this file to do any custom updates during post-install.
const customUpdate = () => {
    // Custom logic here
    // ...
}

// Call custom update
customUpdate();

Logger.success("Custom update done");