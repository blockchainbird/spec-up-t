const fs = require('fs-extra');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');
const Logger = require('./utils/logger');

/**
 * Creates DOCX metadata from config
 */
function createDocxMetadata(config) {
    return {
        title: config.specs[0].title || 'Untitled Document',
        subject: config.specs[0].description || '',
        creator: config.specs[0].author || '',
        keywords: config.specs[0].keywords || [],
        description: config.specs[0].description || '',
        lastModifiedBy: 'Spec-Up DOCX Generator',
        revision: 1,
        createdAt: new Date(),
        modifiedAt: new Date()
    };
}

/**
 * Converts HTML heading to DOCX heading level
 */
function getHeadingLevel(tagName) {
    const levels = {
        'h1': HeadingLevel.HEADING_1,
        'h2': HeadingLevel.HEADING_2,
        'h3': HeadingLevel.HEADING_3,
        'h4': HeadingLevel.HEADING_4,
        'h5': HeadingLevel.HEADING_5,
        'h6': HeadingLevel.HEADING_6
    };
    return levels[tagName.toLowerCase()] || HeadingLevel.HEADING_1;
}

/**
 * Processes HTML node and converts to DOCX paragraphs
 */
function processNode(node, elements = []) {
    if (node.nodeType === 3) { // Text node
        const text = node.textContent.trim();
        if (text) {
            elements.push(new Paragraph({
                children: [new TextRun(text)]
            }));
        }
        return elements;
    }

    if (node.nodeType !== 1) return elements; // Skip non-element nodes

    const tagName = node.tagName.toLowerCase();

    switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            elements.push(new Paragraph({
                text: node.textContent.trim(),
                heading: getHeadingLevel(tagName)
            }));
            break;

        case 'p':
            const textRuns = [];
            processInlineElements(node, textRuns);
            if (textRuns.length > 0) {
                elements.push(new Paragraph({
                    children: textRuns
                }));
            }
            break;

        case 'ul':
        case 'ol':
            const listItems = Array.from(node.children);
            listItems.forEach(li => {
                if (li.tagName.toLowerCase() === 'li') {
                    elements.push(new Paragraph({
                        text: li.textContent.trim(),
                        bullet: { level: 0 }
                    }));
                }
            });
            break;

        case 'table':
            const tableRows = Array.from(node.querySelectorAll('tr'));
            if (tableRows.length > 0) {
                const docxRows = tableRows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    return new TableRow({
                        children: cells.map(cell => new TableCell({
                            children: [new Paragraph({
                                text: cell.textContent.trim()
                            })],
                            width: {
                                size: 100 / cells.length,
                                type: WidthType.PERCENTAGE
                            }
                        }))
                    });
                });

                elements.push(new Table({
                    rows: docxRows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    }
                }));
            }
            break;

        case 'blockquote':
            elements.push(new Paragraph({
                text: node.textContent.trim(),
                indent: {
                    left: 720 // 0.5 inch in twips
                }
            }));
            break;

        case 'dl':
            // Process definition lists
            const dlItems = Array.from(node.children);
            dlItems.forEach(item => {
                if (item.tagName.toLowerCase() === 'dt') {
                    elements.push(new Paragraph({
                        children: [new TextRun({
                            text: item.textContent.trim(),
                            bold: true
                        })]
                    }));
                } else if (item.tagName.toLowerCase() === 'dd') {
                    elements.push(new Paragraph({
                        text: item.textContent.trim(),
                        indent: {
                            left: 360 // 0.25 inch in twips
                        }
                    }));
                }
            });
            break;

        default:
            // For other elements, process their children
            Array.from(node.childNodes).forEach(child => {
                processNode(child, elements);
            });
            break;
    }

    return elements;
}

/**
 * Processes inline elements within paragraphs
 */
function processInlineElements(node, textRuns) {
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) { // Text node
            const text = child.textContent;
            if (text.trim()) {
                textRuns.push(new TextRun(text));
            }
        } else if (child.nodeType === 1) { // Element node
            const tagName = child.tagName.toLowerCase();
            const text = child.textContent.trim();
            
            if (text) {
                switch (tagName) {
                    case 'strong':
                    case 'b':
                        textRuns.push(new TextRun({
                            text: text,
                            bold: true
                        }));
                        break;
                    case 'em':
                    case 'i':
                        textRuns.push(new TextRun({
                            text: text,
                            italics: true
                        }));
                        break;
                    case 'code':
                        textRuns.push(new TextRun({
                            text: text,
                            font: 'Courier New'
                        }));
                        break;
                    case 'a':
                        textRuns.push(new TextRun({
                            text: text,
                            color: '0000FF',
                            underline: {}
                        }));
                        break;
                    default:
                        textRuns.push(new TextRun(text));
                        break;
                }
            }
        }
    });
}

/**
 * Creates a title page
 */
function createTitlePage(config) {
    const elements = [];
    const spec = config.specs[0];

    if (spec.title) {
        elements.push(new Paragraph({
            text: spec.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER
        }));
    }

    if (spec.description) {
        elements.push(new Paragraph({
            text: spec.description,
            alignment: AlignmentType.CENTER
        }));
    }

    if (spec.author) {
        elements.push(new Paragraph({
            text: `Author: ${spec.author}`,
            alignment: AlignmentType.CENTER
        }));
    }

    // Add some spacing
    elements.push(new Paragraph({ text: '' }));
    elements.push(new Paragraph({ text: '' }));

    return elements;
}

(async () => {
    try {
        Logger.info('Starting DOCX generation...');

        // Read and parse the specs.json file
        const config = fs.readJsonSync('specs.json');
        const metadata = createDocxMetadata(config);

        // Extract configuration details
        const outputPath = config.specs[0].output_path;
        const filePath = path.resolve(process.cwd(), outputPath, 'index.html');

        // Check if HTML file exists
        if (!fs.existsSync(filePath)) {
            Logger.error(`HTML file not found at ${filePath}`);
            Logger.info('Please run "npm run render" first to generate the HTML file.');
            return;
        }

        // Read and parse the HTML file
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;

        // Remove unnecessary elements
        document.querySelectorAll('script, style, .d-print-none, [style*="display: none"]').forEach(el => el.remove());

        // Start building the DOCX document
        const docElements = [];

        // Add title page
        docElements.push(...createTitlePage(config));

        // Add table of contents placeholder
        docElements.push(new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-6'
        }));

        // Add page break after TOC
        docElements.push(new Paragraph({
            text: '',
            pageBreakBefore: true
        }));

        // Process the main content
        const mainContent = document.querySelector('main') || document.body;
        processNode(mainContent, docElements);

        // Create the DOCX document
        const doc = new Document({
            properties: {
                title: metadata.title,
                subject: metadata.subject,
                creator: metadata.creator,
                keywords: metadata.keywords.join(', '),
                description: metadata.description,
                lastModifiedBy: metadata.lastModifiedBy,
                revision: metadata.revision,
                createdAt: metadata.createdAt,
                modifiedAt: metadata.modifiedAt
            },
            sections: [{
                children: docElements
            }]
        });

        // Generate the DOCX file
        const buffer = await Packer.toBuffer(doc);
        const docxPath = path.resolve(process.cwd(), 'docs/index.docx');

        // Ensure docs directory exists
        fs.ensureDirSync(path.dirname(docxPath));

        // Write the DOCX file
        fs.writeFileSync(docxPath, buffer);

    Logger.success('DOCX generated successfully! Find the DOCX file in the docs directory.');
    } catch (error) {
    Logger.error('Error generating DOCX:', error);
    process.exit(1);
    }
})();
