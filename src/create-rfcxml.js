/**
 * Spec-Up-T → RFCXML v3 exporter.
 *
 * Usage (from a spec project):
 *   npm run torfcxml              Write {output_path}/{docName}.xml
 *   RFCXML_VALIDATE=1 npm run torfcxml
 *   RFCXML_RENDER=1 npm run torfcxml   (or npm run torfc)
 *
 * See src/pipeline/rfcxml/IETF-SUBMISSION.md for Datatracker posting.
 */

const fs = require('fs-extra');
const path = require('node:path');
const Logger = require('./utils/logger');
const {
    assembleMarkdown,
    loadXtrefs,
    buildRfcXml,
    IetfConfigError,
    validateRfcXml,
    renderRfcXml
} = require('./pipeline/rfcxml');

function specsWithIetf(config) {
    return (config.specs || []).filter(spec => spec && spec.ietf);
}

async function exportRfcXml(options = {}) {
    const cwd = options.cwd || process.cwd();
    const specsPath = path.join(cwd, 'specs.json');
    if (!fs.existsSync(specsPath)) {
        throw new IetfConfigError(`specs.json not found at ${specsPath}`);
    }
    const config = fs.readJsonSync(specsPath);
    const targets = specsWithIetf(config);
    if (!targets.length) {
        throw new IetfConfigError(
            'No spec in specs.json has an `ietf` block. Add IETF Internet-Draft metadata to enable RFCXML export.'
        );
    }

    const xtrefs = loadXtrefs(cwd);
    const outputs = [];

    for (const spec of targets) {
        const { markdown, missing } = assembleMarkdown(spec, cwd);
        for (const rel of missing) {
            Logger.warn(`Markdown file not found (skipped): ${rel}`);
        }
        const { xml, warnings, ietf } = buildRfcXml(spec, markdown, { xtrefs, now: options.now });
        for (const warning of warnings) {
            Logger.warn(warning);
        }
        const outputDir = path.resolve(cwd, spec.output_path || spec.spec_directory || 'docs');
        fs.ensureDirSync(outputDir);
        const filename = `${ietf.docName}.xml`;
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, xml, 'utf8');
        Logger.success(`RFCXML written to ${outputPath}`);
        outputs.push({ spec, ietf, xml, outputPath, filename });
    }
    return outputs;
}

async function maybeValidateAndRender(outputs, options = {}) {
    const shouldValidate = options.validate || process.env.RFCXML_VALIDATE === '1' || process.env.RFCXML_RENDER === '1';
    const shouldRender = options.render || process.env.RFCXML_RENDER === '1';
    if (!shouldValidate && !shouldRender) {
        return;
    }

    for (const item of outputs) {
        if (shouldValidate) {
            Logger.info(`Validating ${item.filename}…`);
            const result = await validateRfcXml(item.xml, {
                filename: item.filename,
                tmpDir: path.dirname(item.outputPath),
                allowRemote: process.env.RFCXML_ALLOW_REMOTE !== '0'
            });
            if (result.skipped) {
                Logger.warn(`RFCXML validation skipped: ${result.reason}`);
            } else if (result.ok) {
                Logger.success(`RFCXML validation passed (${result.engine})`);
            } else {
                Logger.error('RFCXML validation failed', {
                    context: result.engine,
                    details: result.errors.join('\n')
                });
            }
        }

        if (shouldRender) {
            const dir = path.dirname(item.outputPath);
            const base = item.ietf.docName;
            for (const format of ['html', 'text', 'pdf']) {
                const ext = format === 'text' ? 'txt' : format;
                const dest = path.join(dir, `${base}.${ext}`);
                Logger.info(`Rendering IETF ${format} → ${dest}`);
                const result = await renderRfcXml(item.xml, format, {
                    filename: item.filename,
                    outputPath: dest,
                    tmpDir: dir,
                    allowRemote: process.env.RFCXML_ALLOW_REMOTE !== '0'
                });
                if (result.skipped) {
                    Logger.warn(`IETF ${format} render skipped: ${result.reason}`);
                } else if (result.ok) {
                    Logger.success(`Wrote ${dest} (${result.engine})`);
                } else {
                    Logger.error(`IETF ${format} render failed`, {
                        context: result.engine,
                        details: (result.errors || []).join('\n')
                    });
                }
            }
        }
    }
}

async function run() {
    try {
        Logger.info('Starting RFCXML export…');
        const outputs = await exportRfcXml();
        await maybeValidateAndRender(outputs);
        Logger.info('Post the XML to Datatracker as an Internet-Draft. See node_modules/spec-up-t/src/pipeline/rfcxml/IETF-SUBMISSION.md');
    } catch (error) {
        Logger.error(error.message, {
            context: 'RFCXML export',
            hint: error.name === 'IetfConfigError'
                ? 'Add an `ietf` object to the spec entry in specs.json (docName, category, ipr, authors).'
                : 'Check specs.json and markdown sources, then retry.'
        });
        process.exitCode = 1;
    }
}

module.exports = {
    exportRfcXml,
    maybeValidateAndRender
};

if (process.env.RFCXML_NO_CLI !== '1') {
    run();
}
