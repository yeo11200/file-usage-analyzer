# File Usage Analyzer

A powerful utility to analyze file usage in JavaScript/TypeScript projects, identifying which files are unused and potentially removable.

## Features

- Detects which files are imported by other files
- Handles various import patterns (static, dynamic, named, etc.)
- Special handling for Vue, React, and service patterns
- Configurable file type categorization
- **Customizable import detection patterns**
- Detailed reports in JSON and Markdown formats
- Summary statistics by file type

## Installation

### Global Installation

```bash
npm install -g file-usage-analyzer
```

### Local Installation

```bash
npm install --save-dev file-usage-analyzer
```

## Usage

### Command Line

```bash
# Basic usage (analyzes src folder)
file-usage-analyzer

# Analyze a specific folder
file-usage-analyzer --src app

# Use custom patterns
file-usage-analyzer --patterns "app/**/*.js,app/**/*.vue"

# Specify main file (for special pattern detection)
file-usage-analyzer --main app.js

# Custom output directory
file-usage-analyzer --output reports

# Don't generate output files (just display summary)
file-usage-analyzer --no-files
```

### Programmatic Usage

```javascript
const { analyzeProject } = require('file-usage-analyzer');

// Basic usage
analyzeProject()
  .then(result => {
    console.log(result.summary);
  })
  .catch(err => {
    console.error('Analysis failed:', err);
  });

// With options
analyzeProject({
  src: 'app',
  patterns: ['app/**/*.js', 'app/**/*.vue'],
  mainJsPattern: 'app.js',
  providePattern: /app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g,
  fileTypeMapping: {
    '/components/': 'component',
    '/services/': 'service',
    '/pages/': 'page'
  },
  // Custom import patterns
  importPatterns: {
    staticImport: /import .+ from ['"](.+)['"]/g,
    namedImport: /import ['"](.+)['"]/g,
    // Override only what you need
  },
  outputDir: 'reports',
  generateFiles: true
})
  .then(result => {
    // result.analysis - detailed file analysis
    // result.summary - summary statistics
    // result.markdown - markdown report content
    console.log(`Total files: ${result.summary.total}`);
    console.log(`Unused files: ${result.summary.unused}`);
  });
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `src` | Source directory to analyze | `'src'` |
| `patterns` | File patterns to include | `['src/**/*.{js,vue,ts}']` |
| `fileTypeMapping` | Mapping of path patterns to file types | See default mapping |
| `providePattern` | RegExp for detecting special provide patterns | `/app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g` |
| `mainJsPattern` | Pattern to identify main app file | `'main.js'` |
| `importPatterns` | Custom regex patterns for import detection | See default patterns |
| `outputDir` | Directory for output files | `'./'` |
| `generateFiles` | Whether to generate output files | `true` |

### Default File Type Mapping

```javascript
{
  '/services/': 'service',
  '/components/': 'component',
  '/views/': 'view',
  '/store/': 'store',
  '/utils/': 'utility',
  '/router/': 'router',
  '/assets/': 'asset',
  '/constants/': 'constant'
}
```

### Default Import Patterns

These are the default regular expressions used to detect different types of imports:

```javascript
{
  staticImport: /import .+ from ['"](.+)['"]/g,
  namedImport: /import ['"](.+)['"]/g,
  lazyImport: /import\(['"](.+)['"]\)/g,
  routerImport: /component: \(\) => import\(['"](.+)['"]\)/g,
  provideImport: /provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
  appProvideImport: /app\.provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
  vueComponentImport: /components: {[^}]*['"]([^'"]+)['"]/g,
  serviceImport: /from ['"](@\/services\/[^'"]+)['"]/g
}
```

You can override any pattern by providing your own in the `importPatterns` option.

## Output Files

- `file-analysis.json` - Complete analysis data
- `file-analysis-table.json` - Simplified format for UI display
- `file-analysis-summary.json` - Summary statistics
- `file-analysis.md` - Markdown report with summary and unused files

## License

MIT