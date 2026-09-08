/**
 * Validate and normalize the optional `ietf` block on a Spec-Up-T spec entry.
 */

const VALID_CATEGORIES = new Set(['std', 'bcp', 'exp', 'info', 'historic']);
const VALID_SUBMISSION_TYPES = new Set(['IETF', 'IAB', 'IRTF', 'independent', 'editorial']);
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

class IetfConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IetfConfigError';
    }
}

function requireIetfBlock(spec) {
    if (!spec || typeof spec !== 'object' || !spec.ietf || typeof spec.ietf !== 'object') {
        throw new IetfConfigError(
            'Missing `ietf` block in specs.json. RFCXML export requires IETF Internet-Draft metadata.'
        );
    }
    return spec.ietf;
}

function parseDate(value, fallback = new Date()) {
    if (!value) {
        return {
            year: fallback.getUTCFullYear(),
            month: MONTH_NAMES[fallback.getUTCMonth()],
            day: fallback.getUTCDate()
        };
    }

    if (typeof value === 'string') {
        const iso = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
        if (!iso) {
            throw new IetfConfigError(`Invalid ietf.date string "${value}". Use YYYY-MM-DD.`);
        }
        const monthIndex = Number(iso[2]) - 1;
        return {
            year: Number(iso[1]),
            month: MONTH_NAMES[monthIndex] || iso[2],
            day: iso[3] ? Number(iso[3]) : undefined
        };
    }

    const year = value.year;
    if (!year) {
        throw new IetfConfigError('ietf.date.year is required when date is an object.');
    }
    let month = value.month;
    if (typeof month === 'number') {
        month = MONTH_NAMES[month - 1] || String(month);
    }
    return {
        year,
        month: month || MONTH_NAMES[fallback.getUTCMonth()],
        day: value.day
    };
}

function normalizeAuthor(author, index) {
    if (!author || typeof author !== 'object') {
        throw new IetfConfigError(`ietf.authors[${index}] must be an object.`);
    }
    const fullname = author.fullname || [author.initials, author.surname].filter(Boolean).join(' ').trim();
    const surname = author.surname || (fullname ? fullname.split(/\s+/).pop() : '');
    if (!fullname && !surname) {
        throw new IetfConfigError(`ietf.authors[${index}] needs fullname or surname.`);
    }
    return {
        fullname: fullname || surname,
        initials: author.initials,
        surname,
        organization: author.organization || '',
        email: author.email,
        role: author.role,
        postal: author.postal
    };
}

function normalizeIetfConfig(spec, now = new Date()) {
    const raw = requireIetfBlock(spec);
    if (!raw.docName || typeof raw.docName !== 'string') {
        throw new IetfConfigError('ietf.docName is required (for example "draft-ssmith-keri-00").');
    }
    if (!raw.category || !VALID_CATEGORIES.has(raw.category)) {
        throw new IetfConfigError(
            `ietf.category must be one of: ${[...VALID_CATEGORIES].join(', ')}.`
        );
    }
    if (!raw.ipr || typeof raw.ipr !== 'string') {
        throw new IetfConfigError('ietf.ipr is required (typically "trust200902" for IETF I-Ds).');
    }
    if (!Array.isArray(raw.authors) || raw.authors.length === 0) {
        throw new IetfConfigError('ietf.authors must be a non-empty array of author objects.');
    }

    const submissionType = raw.submissionType || 'IETF';
    if (!VALID_SUBMISSION_TYPES.has(submissionType)) {
        throw new IetfConfigError(
            `ietf.submissionType must be one of: ${[...VALID_SUBMISSION_TYPES].join(', ')}.`
        );
    }

    const keywords = raw.keyword || raw.keywords || [];
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];

    return {
        docName: raw.docName.trim(),
        category: raw.category,
        ipr: raw.ipr,
        submissionType,
        consensus: raw.consensus === true || raw.consensus === 'yes' || raw.consensus === 'true',
        workgroup: raw.workgroup || '',
        area: raw.area || '',
        keyword: keywordList.map(String).filter(Boolean),
        title: raw.title || spec.title || 'Untitled',
        abbrev: raw.abbrev,
        abstract: raw.abstract || spec.description || '',
        authors: raw.authors.map(normalizeAuthor),
        date: parseDate(raw.date, now),
        obsoletes: raw.obsoletes || '',
        updates: raw.updates || '',
        tocInclude: raw.tocInclude !== false,
        sortRefs: raw.sortRefs !== false,
        symRefs: raw.symRefs !== false,
        references: raw.references || { normative: [], informative: [] }
    };
}

module.exports = {
    IetfConfigError,
    MONTH_NAMES,
    requireIetfBlock,
    parseDate,
    normalizeAuthor,
    normalizeIetfConfig
};
