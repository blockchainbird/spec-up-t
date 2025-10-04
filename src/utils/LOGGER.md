# Logger Utility

A centralized logging utility for the spec-up-t project that provides consistent, color-coded console output using chalk.

## Features

- **Color-coded messages** for different log levels
- **Consistent icons** and formatting
- **Progress indicators** with visual progress bars
- **Section separators** for organized output
- **Terminal-friendly** symbols that work across platforms

## Usage

```javascript
const Logger = require('./src/utils/logger');

// Success messages (green with checkmark)
Logger.success('Operation completed successfully');

// Error messages (red with X mark)
Logger.error('Failed to process request');

// Warning messages (yellow with warning symbol)
Logger.warn('Configuration file not found, using defaults');

// Info messages (blue with info symbol)
Logger.info('Processing 42 external references');

// Processing status (cyan with arrow)
Logger.process('Processing repository: owner/repo (15 terms)');

// Highlighted information (magenta with star)
Logger.highlight('Grouped 42 terms into 6 repositories');

// Progress indicators
Logger.progress(3, 5, 'Processing terms'); // Shows: [████████████░░░░░░░░] 60% Processing terms

// Section separators
Logger.separator(); // Shows: ════════════════════════════════════════════════════════════
```

## Log Levels

| Method | Color | Icon | Purpose |
|--------|-------|------|---------|
| `success()` | Green | ✓ | Successful operations |
| `error()` | Red | ✗ | Errors and failures |
| `warn()` | Yellow | ⚠ | Warnings and non-critical issues |
| `info()` | Blue | ℹ | General information |
| `process()` | Cyan | → | Processing status updates |
| `highlight()` | Magenta | ★ | Important data/summaries |
| `debug()` | Gray | ◦ | Debug information |

## Migration from console.log

**Before:**
```javascript
console.log(`✅ Successfully processed ${count} items`);
console.log(`❌ Failed to fetch data from ${url}`);
console.log(`⚠️ Missing configuration file`);
```

**After:**
```javascript
Logger.success(`Successfully processed ${count} items`);
Logger.error(`Failed to fetch data from ${url}`);
Logger.warn('Missing configuration file');
```

## Dependencies

- `chalk@4` - For terminal colors (CommonJS compatible version)

## Installation

The logger is automatically available when chalk v4 is installed:

```bash
npm install chalk@4
```
