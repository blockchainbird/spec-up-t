#!/usr/bin/env node
/**
 * Interactive Spec-Up-T menu. Works on Windows, macOS, and Linux (Node.js only).
 */

const { spawnSync } = require('node:child_process');
const readlineSync = require('readline-sync');

const DOCS_URL = 'https://trustoverip.github.io/spec-up-t-website/';

const OPTIONS = [
    { label: 'Add content', action: doAddContent },
    { label: 'Render specification', action: () => runNpm('render') },
    { label: 'Export to PDF', action: () => runNpm('topdf') },
    { label: 'Export to DOCX', action: () => runNpm('todocx') },
    { label: 'Export to RFCXML (IETF)', action: () => runNpm('torfcxml') },
    { label: 'Export IETF HTML/TXT/PDF', action: () => runNpm('torfc') },
    { label: 'Collect external references', action: () => runNpm('collectExternalReferences') },
    { label: 'Add, remove or view xref source', action: () => runNpm('addremovexrefsource') },
    { label: 'Configure', action: () => runNpm('configure') },
    { label: 'Run health check', action: () => runNpm('healthCheck') },
    { label: 'Open documentation website', action: doHelp },
    { label: 'Freeze specification', action: () => runNpm('freeze') },
];

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runNpm(script) {
    console.clear();
    spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
}

function showProgress() {
    for (let i = 0; i < 3; i++) {
        process.stdout.write('.');
        sleep(200);
    }
    console.log('');
}

function openDocsUrl() {
    if (process.platform === 'win32') {
        spawnSync('cmd', ['/c', 'start', '', DOCS_URL], { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
        spawnSync('open', [DOCS_URL], { stdio: 'ignore' });
    } else {
        spawnSync('xdg-open', [DOCS_URL], { stdio: 'ignore' });
    }
}

function doAddContent() {
    console.clear();
    console.log(
        '\n\n\n   ********************\n\n\n' +
        '   You can start adding your content to the markdown files in the "spec" directory.\n\n' +
        '   You can do this by editing local files in an editor or by going to your repository on GitHub.\n\n' +
        '   More info: https://trustoverip.github.io/spec-up-t-website/docs/various-roles/content-authors-guide/introduction\n\n\n' +
        '   ********************'
    );
}

function doHelp() {
    console.clear();
    console.log(
        `\n\n\n   You will be redirected to the documentation website\n\n   (${DOCS_URL}).`
    );
    sleep(2000);
    openDocsUrl();
}

function displayIntro() {
    console.clear();
    console.log(`
  ,---.                  .   .        --.--
  \`---.,---.,---.,---.   |   |,---.     |  
      ||   ||---'|    ---|   ||   |---  |  
  \`---'|---'\`---'\`---'   \`---'|---'     \`  
       |                      |            

  Please choose one of the following options:

   [0] Add content
   [1] Render specification
   [2] Export to PDF
   [3] Export to DOCX
   [4] Collect external references
   [5] Add, remove or view xref source
   [6] Configure
   [7] Run health check
   [8] Open documentation website
   [9] Freeze specification
   [Q] Quit

   An xref is a reference to another repository.
`);
}

function goodbye() {
    console.clear();
    console.log(`
  ************************************
  Goodbye! You chose to exit.
  ************************************
`);
}

function remindMenu() {
    console.log(`\n\n\nℹ️ Type 'npm run menu' to return to the main menu.\n`);
}

function handleChoice(choice) {
    const index = Number(choice);
    if (Number.isInteger(index) && index >= 0 && index < OPTIONS.length) {
        const option = OPTIONS[index];
        console.log(`\n\n  ************************************`);
        console.log(`  ${option.label}`);
        console.log(`  ************************************\n\n`);
        showProgress();
        option.action();
    } else {
        goodbye();
    }
    remindMenu();
}

function main(args = process.argv.slice(2)) {
    const arg = args[0];
    if (arg !== undefined && /^[0-9]$/.test(arg)) {
        handleChoice(arg);
        return;
    }

    displayIntro();
    const choice = readlineSync.keyIn('   Enter your choice: ', {
        limit: '$<0-9>qQ',
        limitMessage: '',
    });
    console.log('\n');

    if (/^[Qq]$/.test(choice)) {
        goodbye();
        remindMenu();
        return;
    }

    handleChoice(choice);
}

if (require.main === module) {
    main();
}

module.exports = main;
