"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultImportPatterns = exports.defaultMainJsPattern = exports.defaultProvidePattern = exports.defaultFileTypeMapping = void 0;
exports.getFileType = getFileType;
exports.parseImports = parseImports;
exports.processMainFile = processMainFile;
exports.processAppProvides = processAppProvides;
exports.analyzeProject = analyzeProject;
exports.runFromCommandLine = runFromCommandLine;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = __importDefault(require("glob"));
// Default configurations
exports.defaultFileTypeMapping = {
    '/services/': 'service',
    '/components/': 'component',
    '/views/': 'view',
    '/store/': 'store',
    '/utils/': 'utility',
    '/router/': 'router',
    '/assets/': 'asset',
    '/constants/': 'constant'
};
exports.defaultProvidePattern = /app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g;
exports.defaultMainJsPattern = 'main.js';
// Default import detection patterns
exports.defaultImportPatterns = {
    staticImport: /import .+ from ['"](.+)['"]/g,
    namedImport: /import ['"](.+)['"]/g,
    lazyImport: /import\(['"](.+)['"]\)/g,
    routerImport: /component: \(\) => import\(['"](.+)['"]\)/g,
    provideImport: /provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
    appProvideImport: /app\.provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
    vueComponentImport: /components: {[^}]*['"]([^'"]+)['"]/g,
    serviceImport: /from ['"](@\/services\/[^'"]+)['"]/g
};
/**
 * Determine file type based on its path and type mapping
 */
function getFileType(filePath, typeMapping = exports.defaultFileTypeMapping) {
    for (const key in typeMapping) {
        if (filePath.includes(key)) {
            return typeMapping[key];
        }
    }
    return 'other';
}
/**
 * Parse imports from file content
 */
function parseImports(content, filePath, patterns = exports.defaultImportPatterns) {
    const imports = [];
    // Regular imports
    const staticImports = content.match(patterns.staticImport || exports.defaultImportPatterns.staticImport) || [];
    const namedImports = content.match(patterns.namedImport || exports.defaultImportPatterns.namedImport) || [];
    const lazyImports = content.match(patterns.lazyImport || exports.defaultImportPatterns.lazyImport) || [];
    const routerImports = content.match(patterns.routerImport || exports.defaultImportPatterns.routerImport) || [];
    const provideImports = content.match(patterns.provideImport || exports.defaultImportPatterns.provideImport) || [];
    const appProvideImports = content.match(patterns.appProvideImport || exports.defaultImportPatterns.appProvideImport) || [];
    const vueComponentImports = content.match(patterns.vueComponentImport || exports.defaultImportPatterns.vueComponentImport) || [];
    // Process service imports specially
    const serviceMatches = content.match(patterns.serviceImport || exports.defaultImportPatterns.serviceImport) || [];
    serviceMatches.forEach((serviceImport) => {
        const match = serviceImport.match(/from ['"](@\/services\/[^'"]+)['"]/);
        if (match && match[1]) {
            const servicePath = match[1];
            let importPath = servicePath.replace('@/', 'src/');
            imports.push(importPath);
            imports.push(`${importPath}.js`);
            // Handle nested folder structures
            if (importPath.includes('/')) {
                const parts = importPath.split('/');
                const fileName = parts.pop();
                const parentDir = parts.join('/');
                imports.push(`${parentDir}/${fileName}.js`);
                imports.push(`${parentDir}/${fileName}/index.js`);
                imports.push(`${parentDir}/${fileName}/Index.js`);
                if (fileName.includes('.')) {
                    const nameParts = fileName.split('.');
                    imports.push(`${parentDir}/${nameParts[0]}.js`);
                    imports.push(`${parentDir}/${nameParts[0]}/index.js`);
                }
            }
        }
    });
    // Process all import patterns
    [
        ...staticImports,
        ...namedImports,
        ...lazyImports,
        ...routerImports,
        ...provideImports,
        ...appProvideImports,
        ...vueComponentImports,
    ].forEach((importStmt) => {
        let match = null;
        if (importStmt.includes('() =>')) {
            match = importStmt.match(/import\(['"](.+)['"]\)/);
        }
        else if (importStmt.includes('import(')) {
            match = importStmt.match(/import\(['"](.+)['"]\)/);
        }
        else if (importStmt.startsWith('import "') || importStmt.startsWith("import '")) {
            match = importStmt.match(/import ['"](.+)['"]/);
        }
        else if (importStmt.includes('provide')) {
            match = importStmt.match(/['"]([@/][^'"]+)['"]/);
        }
        else if (importStmt.includes('components:')) {
            match = importStmt.match(/['"]([^'"]+)['"]/);
        }
        else {
            match = importStmt.match(/from ['"](.+)['"]/);
        }
        if (match && match[1]) {
            let importPath = match[1];
            // Skip node_modules
            if (!importPath.includes('node_modules')) {
                // Handle @/ paths
                if (importPath.startsWith('@/')) {
                    importPath = importPath.replace('@/', 'src/');
                }
                // Handle paths without extensions
                if (!path.extname(importPath) && !importPath.endsWith('/')) {
                    const possiblePaths = [
                        `${importPath}.vue`,
                        `${importPath}.js`,
                        `${importPath}.ts`,
                        `${importPath}/index.vue`,
                        `${importPath}/Index.vue`,
                    ];
                    // Special handling for API/services
                    if (importPath.includes('/services/')) {
                        if (importPath.includes('/api/')) {
                            possiblePaths.push(importPath.replace('/api/', '/') + '.js');
                        }
                        else {
                            const parts = importPath.split('/');
                            const filename = parts.pop();
                            if (filename) {
                                possiblePaths.push([...parts, 'api', filename].join('/') + '.js');
                            }
                        }
                        // Handle nested service structures
                        const serviceParts = importPath.split('/services/');
                        if (serviceParts.length > 1) {
                            const servicePath = serviceParts[1];
                            possiblePaths.push(`src/services/${servicePath}.js`);
                            if (servicePath.includes('/')) {
                                const subParts = servicePath.split('/');
                                const subFileName = subParts.pop();
                                const subDir = subParts.join('/');
                                possiblePaths.push(`src/services/${subDir}/${subFileName}.js`);
                                possiblePaths.push(`src/services/${subDir}/${subFileName}/index.js`);
                                possiblePaths.push(`src/services/${subDir}/${subFileName}/Index.js`);
                                if (subFileName.includes('-')) {
                                    const nameParts = subFileName.split('-');
                                    possiblePaths.push(`src/services/${subDir}/${nameParts.join('')}.js`);
                                }
                            }
                        }
                    }
                    imports.push(...possiblePaths);
                }
                else {
                    imports.push(importPath);
                }
            }
        }
    });
    return imports;
}
/**
 * Process special patterns in main file
 */
function processMainFile(mainJsFile, srcFiles, importedByMap, providePattern = exports.defaultProvidePattern) {
    if (!mainJsFile)
        return;
    const content = fs.readFileSync(mainJsFile, 'utf8');
    let match;
    while ((match = providePattern.exec(content)) !== null) {
        const provideKey = match[1]; // e.g. $localStorage
        // Find service files
        if (provideKey.startsWith('$')) {
            const serviceName = provideKey.substring(1);
            const kebabServiceName = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            srcFiles.forEach((srcFile) => {
                if (srcFile.includes('/services/') &&
                    (srcFile.toLowerCase().includes(kebabServiceName) || srcFile.includes(serviceName))) {
                    const importedBy = importedByMap.get(srcFile) || [];
                    if (!importedBy.includes(mainJsFile)) {
                        importedBy.push(mainJsFile);
                        importedByMap.set(srcFile, importedBy);
                    }
                }
            });
        }
    }
}
/**
 * Process app.provide patterns in a file
 */
function processAppProvides(file, content, srcFiles, imports, appProvidePattern = /app\.provide\(['"]([^'"]+)['"], [^)]+\)/g) {
    if (!file.includes('main.js'))
        return;
    let match;
    const appProvideDirectMatches = [];
    while ((match = appProvidePattern.exec(content)) !== null) {
        appProvideDirectMatches.push(match[1]);
    }
    if (appProvideDirectMatches.length === 0)
        return;
    // Find potential service files
    const serviceFiles = srcFiles.filter((f) => f.includes('/services/'));
    appProvideDirectMatches.forEach((provideKey) => {
        if (provideKey.startsWith('$')) {
            const serviceName = provideKey.substring(1);
            const kebabCase = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            serviceFiles.forEach((serviceFile) => {
                if (serviceFile.toLowerCase().includes(kebabCase)) {
                    imports.push(serviceFile);
                }
            });
        }
    });
}
/**
 * Analyze file usage in the given project
 */
function analyzeProject(options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const { src = 'src', patterns = [`${src}/**/*.{js,vue,ts}`], fileTypeMapping = exports.defaultFileTypeMapping, providePattern = exports.defaultProvidePattern, mainJsPattern = exports.defaultMainJsPattern, outputDir = './', generateFiles = true, importPatterns = exports.defaultImportPatterns } = options;
            // Find all source files
            const srcFiles = glob_1.default.sync(patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]);
            console.log(`Analyzing ${srcFiles.length} files...`);
            // Maps to store analysis data
            const allImports = new Map();
            const importedByMap = new Map();
            // Initialize importedByMap
            srcFiles.forEach(file => {
                importedByMap.set(file, []);
            });
            // Process imports for each file
            srcFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                const imports = parseImports(content, file, importPatterns);
                // Handle app.provide patterns
                processAppProvides(file, content, srcFiles, imports, importPatterns.appProvideImport || exports.defaultImportPatterns.appProvideImport);
                // Store imports
                allImports.set(file, imports);
            });
            // Build reverse mapping (which files are imported by others)
            allImports.forEach((imports, importingFile) => {
                imports.forEach(importedPath => {
                    const normalizedPath = path.normalize(importedPath);
                    srcFiles.forEach(srcFile => {
                        const absoluteSrcPath = path.resolve(srcFile);
                        if (absoluteSrcPath.endsWith(normalizedPath) ||
                            normalizedPath.endsWith(srcFile) ||
                            path.basename(absoluteSrcPath) === path.basename(normalizedPath) ||
                            (srcFile.includes('/services/') &&
                                (normalizedPath.includes(path.basename(srcFile)) ||
                                    srcFile.includes(path.basename(normalizedPath))))) {
                            const importedBy = importedByMap.get(srcFile) || [];
                            if (!importedBy.includes(importingFile)) {
                                importedBy.push(importingFile);
                                importedByMap.set(srcFile, importedBy);
                            }
                        }
                    });
                });
            });
            // Handle main.js special case
            const mainJsFile = srcFiles.find(f => f.endsWith(mainJsPattern));
            if (mainJsFile) {
                processMainFile(mainJsFile, srcFiles, importedByMap, providePattern);
            }
            // Build final analysis
            const fileAnalysis = { files: [] };
            srcFiles.forEach(file => {
                const importedBy = importedByMap.get(file) || [];
                fileAnalysis.files.push({
                    path: file,
                    type: getFileType(file, fileTypeMapping),
                    isUsed: importedBy.length > 0,
                    importCount: importedBy.length,
                    importedBy: importedBy
                });
            });
            // Generate summary
            const summary = {
                total: srcFiles.length,
                used: fileAnalysis.files.filter(f => f.isUsed).length,
                unused: fileAnalysis.files.filter(f => !f.isUsed).length,
                byType: {}
            };
            // Type-based statistics
            const types = Array.from(new Set(fileAnalysis.files.map(f => f.type)));
            types.forEach(type => {
                const typeFiles = fileAnalysis.files.filter(f => f.type === type);
                summary.byType[type] = {
                    total: typeFiles.length,
                    used: typeFiles.filter(f => f.isUsed).length,
                    unused: typeFiles.filter(f => !f.isUsed).length
                };
            });
            // Generate markdown report
            let markdown = '# File Usage Analysis Results\n\n';
            // Summary section
            markdown += '## Summary\n\n';
            markdown += `- Total files: ${summary.total}\n`;
            markdown += `- Files in use: ${summary.used}\n`;
            markdown += `- Unused files: ${summary.unused}\n\n`;
            // Statistics by type
            markdown += '## Statistics by File Type\n\n';
            markdown += '| File Type | Total | Used | Unused |\n';
            markdown += '|-----------|-------|------|--------|\n';
            Object.entries(summary.byType).forEach(([type, stats]) => {
                markdown += `| ${type} | ${stats.total} | ${stats.used} | ${stats.unused} |\n`;
            });
            // Unused files list
            markdown += '\n## Unused Files List\n\n';
            markdown += '| File Path | Type |\n';
            markdown += '|-----------|------|\n';
            fileAnalysis.files
                .filter(file => !file.isUsed)
                .forEach(file => {
                markdown += `| ${file.path} | ${file.type} |\n`;
            });
            // Write output files if requested
            if (generateFiles) {
                // Ensure output directory exists
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                // Write full analysis
                fs.writeFileSync(path.join(outputDir, 'file-analysis.json'), JSON.stringify(fileAnalysis, null, 2), 'utf-8');
                // Write table format for UI
                const tableData = fileAnalysis.files.map(file => ({
                    filePath: file.path,
                    fileType: file.type,
                    isUsed: file.isUsed ? 'Yes' : 'No',
                    importCount: file.importCount
                }));
                fs.writeFileSync(path.join(outputDir, 'file-analysis-table.json'), JSON.stringify(tableData, null, 2), 'utf-8');
                // Write summary
                fs.writeFileSync(path.join(outputDir, 'file-analysis-summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
                // Write markdown
                fs.writeFileSync(path.join(outputDir, 'file-analysis.md'), markdown, 'utf-8');
                console.log(`Analysis results have been saved to ${outputDir}`);
            }
            resolve({
                analysis: fileAnalysis,
                summary,
                markdown
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
/**
 * Run the analyzer with command line arguments
 */
function runFromCommandLine() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--src' && args[i + 1]) {
            options.src = args[i + 1];
            i++;
        }
        else if (args[i] === '--patterns' && args[i + 1]) {
            options.patterns = args[i + 1].split(',');
            i++;
        }
        else if (args[i] === '--main' && args[i + 1]) {
            options.mainJsPattern = args[i + 1];
            i++;
        }
        else if (args[i] === '--output' && args[i + 1]) {
            options.outputDir = args[i + 1];
            i++;
        }
        else if (args[i] === '--no-files') {
            options.generateFiles = false;
        }
    }
    console.log('Starting file usage analysis with options:', options);
    analyzeProject(options)
        .then(result => {
        console.log('Analysis completed successfully.');
        if (!options.generateFiles) {
            console.log('Summary:', result.summary);
        }
    })
        .catch(error => {
        console.error('Error during analysis:', error);
        process.exit(1);
    });
}
// Auto-run if executed directly
if (require.main === module) {
    runFromCommandLine();
}
//# sourceMappingURL=index.js.map