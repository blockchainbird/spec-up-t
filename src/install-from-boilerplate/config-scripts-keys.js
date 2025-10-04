const configScriptsKeys = {
    "edit": "node -e \"require('spec-up-t')()\"",
    "render": "node --no-warnings -e \"require('spec-up-t/index.js')({ nowatch: true })\"",
    "dev": "node -e \"require('spec-up-t')({ dev: true })\"",
    "collectExternalReferences": "node --no-warnings -e \"require('spec-up-t/src/pipeline/references/collect-external-references.js').collectExternalReferences()\"",
    "topdf": "node -e \"require('spec-up-t/src/create-pdf.js')\"",
    "todocx": "node -e \"require('spec-up-t/src/create-docx.js')\"",
    "freeze": "node -e \"require('spec-up-t/src/freeze-spec-data.js')\"",
    "references": "node -e \"require('spec-up-t/src/pipeline/references/external-references-service.js')\"",
    "help": "cat ./node_modules/spec-up-t/src/install-from-boilerplate/help.txt",
    "menu": "bash ./node_modules/spec-up-t/src/install-from-boilerplate/menu.sh",
    "addremovexrefsource": "node --no-warnings -e \"require('spec-up-t/src/add-remove-xref-source.js')\"",
    "configure": "node --no-warnings -e \"require('spec-up-t/src/configure.js')\"",
    "healthCheck": "node --no-warnings -e \"require('spec-up-t/src/health-check.js')\"",
    "custom-update": "npm update && node -e \"require('spec-up-t/src/install-from-boilerplate/custom-update.js')\""
};

// Defines which script keys to overwrite. If a key is not present, it will not be overwritten
const configOverwriteScriptsKeys = {
    "edit": true,
    "render": true,
    "dev": true,
    "collectExternalReferences": true,
    "topdf": true,
    "todocx": true,
    "freeze": true,
    "references": true,
    "help": true,
    "menu": true,
    "addremovexrefsource": true,
    "configure": true,
    "healthCheck": true,
    "custom-update": true
};

module.exports = { configScriptsKeys, configOverwriteScriptsKeys };