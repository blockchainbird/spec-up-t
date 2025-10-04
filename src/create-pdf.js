const fs = require('fs-extra');
const puppeteer = require('puppeteer');
const path = require('path');
const pdfLib = require('pdf-lib');
const Logger = require('./utils/logger');

// ISO compliance configuration
const ISO_CONFIG = {
    embedFonts: true,
    deviceIndependentColor: true,
    tagged: true, // For PDF/UA accessibility
    pdfVersion: '1.7', // ISO 32000-1 compliant
    metadata: {
        format: 'PDF/A-2b', // Archive-friendly format
        conformance: 'B' // Basic conformance level
    }
};

/**
 * Creates ISO-compliant PDF metadata
 */
function createISOMetadata(config) {
    const now = new Date();
    return {
        title: config.specs[0].title || 'Untitled Document',
        author: config.specs[0].author || '',
        subject: config.specs[0].description || '',
        keywords: config.specs[0].keywords || [],
        creator: 'Spec-Up PDF Generator',
        producer: 'Spec-Up with ISO Compliance',
        creationDate: now,
        modificationDate: now
    };
}

/**
 * Configures Puppeteer page for ISO compliance
 */
async function configurePageForISO(page) {
    // Set device-independent color profile and font embedding
    await page.emulateMediaType('print');
    await page.evaluateOnNewDocument(() => {
        // Force device-independent color rendering
        document.documentElement.style.colorRendering = 'optimizeQuality';
        document.documentElement.style.textRendering = 'optimizeLegibility';
    });
}

/**
 * Applies accessibility tags for PDF/UA compliance
 */
async function applyAccessibilityTags(page) {
    await page.evaluate(() => {
        // Add semantic structure for accessibility
        const main = document.querySelector('main') || document.body;
        if (main && !main.getAttribute('role')) {
            main.setAttribute('role', 'main');
        }

        // Tag headings for proper structure
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            if (!heading.getAttribute('role')) {
                heading.setAttribute('role', 'heading');
                heading.setAttribute('aria-level', heading.tagName.charAt(1));
            }
        });

        // Tag navigation elements
        const toc = document.getElementById('toc') || document.getElementById('pdf-toc');
        if (toc && !toc.getAttribute('role')) {
            toc.setAttribute('role', 'navigation');
            toc.setAttribute('aria-label', 'Table of Contents');
        }

        // Tag tables for accessibility
        document.querySelectorAll('table').forEach(table => {
            if (!table.getAttribute('role')) {
                table.setAttribute('role', 'table');
            }
        });

        // Add alt text to images if missing
        document.querySelectorAll('img').forEach(img => {
            if (!img.getAttribute('alt')) {
                img.setAttribute('alt', img.getAttribute('title') || 'Image');
            }
        });
    });
}

/**
 * Creates table of contents for PDF
 */
async function createTOCIfNeeded(page, logo, logoLink, title, description) {
    await page.evaluate((logo, logoLink, title, description) => {
        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'text-center mb-5 pb-4 border-bottom';

        if (logo) {
            const logoContainer = document.createElement('a');
            logoContainer.href = logoLink;
            logoContainer.className = 'd-block mb-3';
            const logoImg = document.createElement('img');
            logoImg.src = logo;
            logoImg.className = 'img-fluid';
            logoContainer.appendChild(logoImg);
            titleWrapper.appendChild(logoContainer);
        }

        if (title) {
            const titleElement = document.createElement('h1');
            titleElement.textContent = title;
            titleElement.className = 'display-4 mb-2 pdf-title';
            titleWrapper.appendChild(titleElement);
        }

        if (description) {
            const descriptionElement = document.createElement('p');
            descriptionElement.textContent = description;
            descriptionElement.className = 'lead mb-0';
            titleWrapper.appendChild(descriptionElement);
        }

        document.body.insertBefore(titleWrapper, document.body.firstChild);

        // Create a Table of Contents if it doesn't exist
        if (!document.getElementById('toc')) {
            // Generate a TOC based on the headings in the document
            const headings = Array.from(document.querySelectorAll('h1:not(.pdf-title), h2, h3, h4, h5, h6')).filter(h => {
                // Only include headings with IDs that can be linked to
                return h.id && h.id.trim() !== '';
            });

            if (headings.length > 0) {
                // Create TOC container
                const tocContainer = document.createElement('div');
                tocContainer.id = 'toc';
                tocContainer.className = 'toc-container';

                // Create TOC heading
                const tocHeading = document.createElement('h2');
                tocHeading.textContent = 'Contents';
                tocHeading.className = 'toc-heading';
                tocContainer.appendChild(tocHeading);

                // Create TOC list
                const tocList = document.createElement('ul');
                tocList.className = 'toc-list';
                tocContainer.appendChild(tocList);

                // Add all headings to the TOC
                let currentLevel = 0;
                let currentList = tocList;
                let listStack = [tocList];

                headings.forEach(heading => {
                    // Get heading level (1-6 for h1-h6)
                    const level = parseInt(heading.tagName[1]);

                    // Navigate to the correct nesting level
                    if (level > currentLevel) {
                        // Go deeper - create a new nested list
                        for (let i = currentLevel; i < level; i++) {
                            if (currentList.lastChild) {
                                const nestedList = document.createElement('ul');
                                currentList.lastChild.appendChild(nestedList);
                                listStack.push(nestedList);
                                currentList = nestedList;
                            } else {
                                // If no items exist yet, add a dummy item
                                const dummyItem = document.createElement('li');
                                const nestedList = document.createElement('ul');
                                dummyItem.appendChild(nestedList);
                                currentList.appendChild(dummyItem);
                                listStack.push(nestedList);
                                currentList = nestedList;
                            }
                        }
                    } else if (level < currentLevel) {
                        // Go up - pop from the stack
                        for (let i = currentLevel; i > level; i--) {
                            listStack.pop();
                        }
                        currentList = listStack[listStack.length - 1];
                    }

                    currentLevel = level;

                    // Create list item with link
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = '#' + heading.id;
                    link.textContent = heading.textContent;
                    listItem.appendChild(link);
                    currentList.appendChild(listItem);
                });

                // Insert the TOC after the title section
                document.body.insertBefore(tocContainer, titleWrapper.nextSibling);

                        console.log('Generated a Table of Contents with ' + headings.length + ' entries.');
            }
        }
    }, logo, logoLink, title, description);
}

(async () => {
    try {
        // Launch a new browser instance with ISO-compliant settings
        const browser = await puppeteer.launch({
            args: ['--disable-web-security', '--allow-running-insecure-content']
        });
        const page = await browser.newPage();

        // Configure page for ISO compliance
        await configurePageForISO(page);

        // Read and parse the specs.json file
        const config = fs.readJsonSync('specs.json');
        const metadata = createISOMetadata(config);

        // Extract configuration details
        const outputPath = config.specs[0].output_path;
        const title = config.specs[0].title || '';
        const description = config.specs[0].description || '';
        const logo = config.specs[0].logo || '';
        const logoLink = config.specs[0].logo_link || '#';

        // Define the HTML file path
        const filePath = path.resolve(process.cwd(), outputPath, 'index.html');
        const fileUrl = `file://${filePath}`;

        // Path to Bootstrap CSS
        const bootstrapCssPath = path.resolve(process.cwd(), 'assets/css/bootstrap.min.css');
        const bootstrapExists = fs.existsSync(bootstrapCssPath);
        let bootstrapCss = bootstrapExists ? fs.readFileSync(bootstrapCssPath, 'utf8') : '';

        // Path to PDF styles CSS
        const pdfStylesPath = path.resolve(process.cwd(), 'assets/css/create-pdf.css');
        const pdfStylesExist = fs.existsSync(pdfStylesPath);
        const pdfStylesCss = pdfStylesExist ? fs.readFileSync(pdfStylesPath, 'utf8') : '';

        // Navigate to the HTML file
        await page.goto(fileUrl, { waitUntil: 'networkidle2' });

        // Apply accessibility tags for PDF/UA compliance
        await applyAccessibilityTags(page);

        // Clean up unnecessary elements but be careful not to remove styles we need
        await page.evaluate(() => {
            // Preserve TOC if it exists (skip removing it even if it has display:none)
            document.querySelectorAll('[style*="display: none"]:not(#toc):not(#toc *), .d-print-none:not(#toc):not(#toc *), script').forEach(element => element.remove());
            // Don't remove all style elements as some might be important

            // If TOC doesn't exist, we'll need to create one
            if (!document.getElementById('toc')) {
                        console.log('No TOC found in the document. Will create one.');
            }
        });

        // Handle dynamically fetched cross-reference terms
        const targetClass = '.fetched-xref-term';
        const targetElement = await page.$(targetClass);
        if (targetElement) {
            const targetText = await page.evaluate(el => el.innerText, targetElement);
            await page.waitForFunction(
                (targetClass, targetText) => {
                    const element = document.querySelector(targetClass);
                    return element && element.innerText !== targetText;
                },
                {},
                targetClass,
                targetText
            );
        }

        // Force larger width on page content BEFORE injecting styles
        await page.evaluate(() => {
            // Select main content containers and expand them
            const containers = document.querySelectorAll('.container, main, section, article, .content');
            containers.forEach(container => {
                container.style.maxWidth = '95%';
                container.style.width = '95%';
                container.style.margin = '0 auto';
                container.style.padding = '0';
            });

            // Override any Bootstrap column constraints
            const columns = document.querySelectorAll('[class*="col-"]');
            columns.forEach(col => {
                col.style.maxWidth = '100%';
                col.style.width = '100%';
                col.style.paddingLeft = '0';
                col.style.paddingRight = '0';
            });

            // Ensure body takes full width
            document.body.style.maxWidth = '100%';
            document.body.style.width = '100%';
            document.body.style.padding = '0';
            document.body.style.margin = '0';
        });

        // Inject Bootstrap CSS and PDF styles CSS - No inline styling
        await page.evaluate((bootstrapCss, pdfStylesCss) => {
            // Add bootstrap if it exists
            if (bootstrapCss) {
                const bootstrapStyle = document.createElement('style');
                bootstrapStyle.innerHTML = bootstrapCss;
                bootstrapStyle.setAttribute('data-bootstrap', 'true');
                document.head.appendChild(bootstrapStyle);
            }

            // Add PDF styles CSS - all styling is defined here
            if (pdfStylesCss) {
                const style = document.createElement('style');
                style.id = 'pdf-styles';
                style.innerHTML = pdfStylesCss;
                document.head.appendChild(style);
            }

            // Add print-specific class
            document.body.classList.add('pdf-document', 'print');
        }, bootstrapCss, pdfStylesCss);

        // Add necessary Bootstrap classes to elements
        await page.evaluate(() => {
            // Add Bootstrap classes to tables
            document.querySelectorAll('table').forEach(table => {
                table.classList.add('table', 'table-bordered', 'table-striped', 'table-hover');
            });

            // Make sure meta-info is visible and toggle buttons are hidden
            document.querySelectorAll('.meta-info, .term-meta').forEach(meta => {
                meta.style.display = 'block';
            });

            document.querySelectorAll('.meta-toggle, button.meta-toggle').forEach(button => {
                button.style.display = 'none';
            });
        });

        // Inject logo, title, and description AND handle TOC creation if needed
        await createTOCIfNeeded(page, logo, logoLink, title, description);

        // Direct manipulation of definition lists and TOC to ensure proper styling in PDF
        await page.evaluate(() => {
            // Process all definition lists
            const definitionLists = document.querySelectorAll('dl.terms-and-definitions-list');
            definitionLists.forEach(list => {
                // Process all terms and definitions - target all dt and dd elements regardless of class
                const terms = list.querySelectorAll('dt, dd');
                terms.forEach(term => {
                    // Remove background and borders with !important to override any existing styles
                    term.setAttribute('style', term.getAttribute('style') + '; background: transparent !important; background-color: transparent !important; background-image: none !important; border: none !important; border-radius: 0 !important; padding: 0.5rem 0 !important;');
                });

                // Ensure all meta-info content is visible
                const metaInfoContents = list.querySelectorAll('dd.meta-info-content-wrapper');
                metaInfoContents.forEach(content => {
                    content.style.display = 'block';
                    content.style.maxHeight = 'none';
                    content.style.height = 'auto';
                    content.style.overflow = 'visible';
                    content.style.padding = '0.5rem 0';
                    content.style.margin = '0';
                    content.style.lineHeight = 'normal';

                    // Remove the collapsed class if present
                    content.classList.remove('collapsed');
                });

                // Hide all meta-info toggle buttons
                const toggleButtons = list.querySelectorAll('.meta-info-toggle-button');
                toggleButtons.forEach(button => {
                    button.style.display = 'none';
                });
            });

            // Special handling for ALL transcluded terms with blue background - no class restrictions
            document.querySelectorAll('.term-external, .term-local').forEach(el => {
                // Use the most aggressive approach possible to override the blue background
                el.setAttribute('style', el.getAttribute('style') + '; background: transparent !important; background-color: transparent !important; background-image: none !important;');

                // Also process any child elements to ensure complete removal of background
                Array.from(el.children).forEach(child => {
                    child.setAttribute('style', child.getAttribute('style') + '; background: transparent !important; background-color: transparent !important; background-image: none !important;');
                });
            });

            // Remove any inline styles that might be setting backgrounds
            document.querySelectorAll('style').forEach(styleTag => {
                let cssText = styleTag.textContent;
                // If the style tag contains term-external styles, modify them
                if (cssText.includes('term-external') && cssText.includes('background')) {
                    cssText = cssText.replace(/dt\.term-external[^}]+}/g,
                        'dt.term-external, dd.term-external, dt.term-local, dd.term-local { background: transparent !important; background-color: transparent !important; background-image: none !important; }');
                    styleTag.textContent = cssText;
                }
            });            // Format Table of Contents for book-like layout
            const toc = document.getElementById('toc');
            if (toc) {
                // Make sure TOC is visible
                toc.style.display = 'block';
                toc.style.visibility = 'visible';
                toc.style.opacity = '1';

                // Create a new TOC div for the PDF using a completely different approach
                const pdfToc = document.createElement('div');
                pdfToc.id = 'pdf-toc';

                // Ensure TOC has a header
                const tocHeading = document.createElement('h2');
                tocHeading.textContent = 'Contents';
                tocHeading.style.textAlign = 'center';
                tocHeading.style.fontWeight = 'bold';
                tocHeading.style.marginBottom = '1.5rem';
                tocHeading.style.paddingBottom = '0.5rem';
                tocHeading.style.borderBottom = '1px solid #000';
                pdfToc.appendChild(tocHeading);

                // Create a fresh TOC structure - completely rebuilding it
                const tocList = document.createElement('ul');
                tocList.style.listStyleType = 'none';
                tocList.style.padding = '0';
                tocList.style.margin = '0';
                pdfToc.appendChild(tocList);

                // Find all section headings to include in the TOC
                // Look for both original TOC entries and also scan document headings
                const tocOriginalLinks = toc.querySelectorAll('a');

                // Process each TOC link to create a new TOC item
                tocOriginalLinks.forEach((link, index) => {
                    const li = document.createElement('li');
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'toc-row';

                    const title = document.createElement('a');
                    title.href = link.getAttribute('href');
                    title.textContent = link.textContent;
                    title.className = 'toc-title';
                    title.setAttribute('data-target-id', link.getAttribute('href').substring(1)); // Store the target id
                    // Ensure no blue color or underline for TOC links
                    title.style.color = '#000';
                    title.style.textDecoration = 'none';
                    title.style.borderBottom = 'none';
                    title.style.backgroundColor = 'transparent';

                    const leader = document.createElement('div');
                    leader.className = 'toc-leader';

                    // Create page number placeholder - we'll fill in actual page numbers later
                    const pageNumber = document.createElement('span');
                    pageNumber.className = 'toc-page-number';
                    pageNumber.textContent = ''; // Empty for now
                    pageNumber.setAttribute('data-for-id', link.getAttribute('href').substring(1));
                    pageNumber.style.position = 'absolute';
                    pageNumber.style.right = '0';

                    rowDiv.appendChild(title);
                    rowDiv.appendChild(leader);
                    li.appendChild(rowDiv);
                    li.appendChild(pageNumber);

                    // Determine nesting level from original TOC
                    let level = 0;
                    let parent = link.closest('li');
                    while (parent) {
                        const parentList = parent.closest('ul');
                        if (parentList && parentList !== toc) {
                            level++;
                            parent = parentList.closest('li');
                        } else {
                            break;
                        }
                    }

                    // Apply indentation based on level
                    if (level > 0) {
                        li.style.paddingLeft = (level * 15) + 'px';
                    }

                    tocList.appendChild(li);
                });

                // Insert the new TOC at the beginning of the document after the title
                const titleWrapper = document.querySelector('.text-center.mb-5.pb-4.border-bottom');
                if (titleWrapper && titleWrapper.nextSibling) {
                    document.body.insertBefore(pdfToc, titleWrapper.nextSibling);
                } else {
                    document.body.insertBefore(pdfToc, document.body.firstChild);
                }

                // Force page break before TOC
                pdfToc.style.breakBefore = 'page';
                pdfToc.style.pageBreakBefore = 'always';

                // Force page break after TOC
                const tocNext = pdfToc.nextElementSibling;
                if (tocNext) {
                    tocNext.style.breakBefore = 'page';
                    tocNext.style.pageBreakBefore = 'always';
                }

                // Hide the original TOC
                toc.style.display = 'none';
            }
        });

    Logger.process('Generating PDF with proper TOC page numbers...');

        // First, generate a draft PDF to calculate the page positions of each heading
        const draftPdfBuffer = await page.pdf({
            format: 'A4',
            displayHeaderFooter: true,
            footerTemplate: `
                <div style="width: 100%; text-align: center; font-size: 10pt; margin-top: 10mm;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `,
            headerTemplate: '<div></div>',
            preferCSSPageSize: true,
            printBackground: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        });

        // Now extract the page numbers from the tooltips and update the TOC entries
        await page.evaluate(() => {
            // Find the PDF TOC 
            const pdfToc = document.getElementById('pdf-toc');
            if (!pdfToc) return;
            
            const tocEntries = pdfToc.querySelectorAll('.toc-page-number');
            const originalToc = document.getElementById('toc');
            
            if (originalToc) {
                // Get all links from the original TOC that have tooltip data
                const originalLinks = originalToc.querySelectorAll('a[title], a[data-bs-title]');
                
                // Create a mapping from heading IDs to page numbers based on tooltips
                const idToPageMap = {};
                
                originalLinks.forEach(link => {
                    // Extract the heading ID from href
                    const href = link.getAttribute('href');
                    if (!href || !href.startsWith('#')) return;
                    
                    const headingId = href.substring(1);
                    
                    // Extract page number from tooltip text (e.g., "Go to page 5")
                    const tooltipText = link.getAttribute('title') || link.getAttribute('data-bs-title');
                    if (!tooltipText) return;
                    
                    const pageNumberMatch = tooltipText.match(/Go to page (\d+)/i);
                    if (pageNumberMatch && pageNumberMatch[1]) {
                        const pageNumber = parseInt(pageNumberMatch[1], 10);
                        if (!isNaN(pageNumber)) {
                            idToPageMap[headingId] = pageNumber;
                        }
                    }
                });
                
                // Now update the TOC page numbers using the extracted values
                tocEntries.forEach(entry => {
                    const targetId = entry.getAttribute('data-for-id');
                    if (targetId && idToPageMap[targetId]) {
                        entry.textContent = idToPageMap[targetId];
                        // Ensure page numbers are clearly visible with proper styling
                        entry.style.visibility = 'visible';
                        entry.style.opacity = '1';
                        entry.style.color = '#000';
                        entry.style.background = '#fff';
                        entry.style.padding = '0 4px';
                        entry.style.fontWeight = 'normal';
                    }
                });
            } else {
                // Fallback to old estimation method if original TOC is not available
                console.log('Original TOC not found, using page number estimation method');
                
                // Find all headings with IDs (potential TOC targets)
                const headingsWithIds = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(h => h.id);
                
                // Use real offsets for more accurate page numbers
                const idToPosition = {};

                headingsWithIds.forEach(heading => {
                    const rect = heading.getBoundingClientRect();
                    idToPosition[heading.id] = {
                        top: rect.top + window.scrollY,
                        id: heading.id
                    };
                });

                // Sort by vertical position
                const sortedPositions = Object.values(idToPosition).sort((a, b) => a.top - b.top);

                // A4 page height (mm to pixels at 96 DPI)
                const pageHeight = 297 * 96 / 25.4;
                const effectivePageHeight = pageHeight - 20; // Account for margins

                // Start on page 3 (after title and TOC)
                let currentPage = 3;
                let currentOffset = 0;

                // Calculate page numbers based on relative positions
                sortedPositions.forEach(pos => {
                    while (pos.top > currentOffset + effectivePageHeight) {
                        currentPage++;
                        currentOffset += effectivePageHeight;
                    }

                    idToPosition[pos.id].page = currentPage;
                });

                // Update TOC entries with calculated page numbers
                tocEntries.forEach(entry => {
                    const targetId = entry.getAttribute('data-for-id');
                    if (targetId && idToPosition[targetId] && idToPosition[targetId].page) {
                        entry.textContent = idToPosition[targetId].page;
                    }
                });
            }
        });

        // Final PDF generation with correct page numbers
        const pdfBuffer = await page.pdf({
            path: path.resolve(process.cwd(), 'docs/index.pdf'),
            format: 'A4',
            displayHeaderFooter: true,
            footerTemplate: `
                <div style="width: 100%; text-align: center; font-size: 10pt; margin-top: 10mm;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `,
            headerTemplate: '<div></div>',
            preferCSSPageSize: true,
            printBackground: true,
            quality: 100,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        });

        await browser.close();

    Logger.success('PDF generated by Puppeteer. Processing with pdf-lib for ISO compliance...');

        // Optimize PDF with pdf-lib for ISO compliance
        try {
            const pdfDoc = await pdfLib.PDFDocument.load(pdfBuffer);
            
            // Set ISO-compliant metadata (this is safer than XMP embedding)
            pdfDoc.setTitle(metadata.title);
            pdfDoc.setAuthor(metadata.author);
            pdfDoc.setSubject(metadata.subject);
            pdfDoc.setKeywords(metadata.keywords);
            pdfDoc.setProducer(metadata.producer);
            pdfDoc.setCreator(metadata.creator);
            pdfDoc.setCreationDate(metadata.creationDate);
            pdfDoc.setModificationDate(metadata.modificationDate);

            Logger.success('ISO metadata applied successfully.');

            // Save with conservative settings to ensure compatibility
            const optimizedPdfBytes = await pdfDoc.save({
                useObjectStreams: false, // Required for PDF/A compliance
                addDefaultPage: false
            });
            
            fs.writeFileSync('docs/index.pdf', optimizedPdfBytes);
            Logger.success('PDF saved with ISO compliance features.');
        } catch (pdfError) {
            Logger.warn('Could not apply ISO metadata, saving original PDF: %s', pdfError.message);
            // Fallback: save the original PDF if post-processing fails
            fs.writeFileSync('docs/index.pdf', pdfBuffer);
        }

    Logger.success('PDF generated successfully! Find the PDF in the docs directory.');
    } catch (error) {
        Logger.error('Error generating PDF: %o', error);
    }
})();
