import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';

// Types
export interface AnalyzedFile {
  path: string;
  content: string;
}

export interface FileAnalysisEntry {
  path: string;
  type: string;
  isUsed: boolean;
  importCount: number;
  importedBy: string[];
}

export interface FileAnalysis {
  files: FileAnalysisEntry[];
}

export interface Summary {
  total: number;
  used: number;
  unused: number;
  byType: Record<string, { total: number; used: number; unused: number }>;
}

export interface AnalysisResult {
  analysis: FileAnalysis;
  summary: Summary;
  markdown: string;
}

export interface FileTypeMapping {
  [pathPattern: string]: string;
}

// Define interface for import detection patterns
export interface ImportPatterns {
  staticImport?: RegExp;
  namedImport?: RegExp;
  lazyImport?: RegExp;
  routerImport?: RegExp;
  provideImport?: RegExp;
  appProvideImport?: RegExp;
  vueComponentImport?: RegExp;
  serviceImport?: RegExp;
}

export interface AnalyzerOptions {
  src?: string;
  patterns?: string[];
  fileTypeMapping?: FileTypeMapping;
  providePattern?: RegExp;
  mainJsPattern?: string;
  outputDir?: string;
  generateFiles?: boolean;
  importPatterns?: ImportPatterns;
}

// Default configurations
export const defaultFileTypeMapping: FileTypeMapping = {
  '/services/': 'service',
  '/components/': 'component',
  '/views/': 'view',
  '/store/': 'store',
  '/utils/': 'utility',
  '/router/': 'router',
  '/assets/': 'asset',
  '/constants/': 'constant'
};

export const defaultProvidePattern = /app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g;
export const defaultMainJsPattern = 'main.js';

// Default import detection patterns
export const defaultImportPatterns: ImportPatterns = {
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
export function getFileType(filePath: string, typeMapping: FileTypeMapping = defaultFileTypeMapping): string {
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
export function parseImports(
  content: string, 
  filePath: string, 
  patterns: ImportPatterns = defaultImportPatterns
): string[] {
  const imports: string[] = [];

  // Regular imports
  const staticImports: string[] = content.match(patterns.staticImport || defaultImportPatterns.staticImport!) || [];
  const namedImports: string[] = content.match(patterns.namedImport || defaultImportPatterns.namedImport!) || [];
  const lazyImports: string[] = content.match(patterns.lazyImport || defaultImportPatterns.lazyImport!) || [];
  const routerImports: string[] = content.match(patterns.routerImport || defaultImportPatterns.routerImport!) || [];
  const provideImports: string[] = content.match(patterns.provideImport || defaultImportPatterns.provideImport!) || [];
  const appProvideImports: string[] = content.match(patterns.appProvideImport || defaultImportPatterns.appProvideImport!) || [];
  const vueComponentImports: string[] = content.match(patterns.vueComponentImport || defaultImportPatterns.vueComponentImport!) || [];

  // Process service imports specially
  const serviceMatches: string[] = content.match(patterns.serviceImport || defaultImportPatterns.serviceImport!) || [];
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
        const fileName = parts.pop()!;
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
    let match: RegExpMatchArray | null = null;

    if (importStmt.includes('() =>')) {
      match = importStmt.match(/import\(['"](.+)['"]\)/);
    } else if (importStmt.includes('import(')) {
      match = importStmt.match(/import\(['"](.+)['"]\)/);
    } else if (importStmt.startsWith('import "') || importStmt.startsWith("import '")) {
      match = importStmt.match(/import ['"](.+)['"]/);
    } else if (importStmt.includes('provide')) {
      match = importStmt.match(/['"]([@/][^'"]+)['"]/);
    } else if (importStmt.includes('components:')) {
      match = importStmt.match(/['"]([^'"]+)['"]/);
    } else {
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
          const possiblePaths: string[] = [
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
            } else {
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
                const subFileName = subParts.pop()!;
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
        } else {
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
export function processMainFile(
  mainJsFile: string,
  srcFiles: string[],
  importedByMap: Map<string, string[]>,
  providePattern: RegExp = defaultProvidePattern
): void {
  if (!mainJsFile) return;
  
  const content = fs.readFileSync(mainJsFile, 'utf8');
  let match: RegExpExecArray | null;
  
  while ((match = providePattern.exec(content)) !== null) {
    const provideKey = match[1]; // e.g. $localStorage
    
    // Find service files
    if (provideKey.startsWith('$')) {
      const serviceName = provideKey.substring(1);
      const kebabServiceName = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      srcFiles.forEach((srcFile) => {
        if (
          srcFile.includes('/services/') &&
          (srcFile.toLowerCase().includes(kebabServiceName) || srcFile.includes(serviceName))
        ) {
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
export function processAppProvides(
  file: string,
  content: string,
  srcFiles: string[],
  imports: string[],
  appProvidePattern: RegExp = /app\.provide\(['"]([^'"]+)['"], [^)]+\)/g
): void {
  if (!file.includes('main.js')) return;
  
  let match: RegExpExecArray | null;
  const appProvideDirectMatches: string[] = [];
  
  while ((match = appProvidePattern.exec(content)) !== null) {
    appProvideDirectMatches.push(match[1]);
  }

  if (appProvideDirectMatches.length === 0) return;
  
  // Find potential service files
  const serviceFiles: string[] = srcFiles.filter((f) => f.includes('/services/'));

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
export function analyzeProject(options: AnalyzerOptions = {}): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    try {
      const {
        src = 'src',
        patterns = [`${src}/**/*.{js,vue,ts}`],
        fileTypeMapping = defaultFileTypeMapping,
        providePattern = defaultProvidePattern,
        mainJsPattern = defaultMainJsPattern,
        outputDir = './',
        generateFiles = true,
        importPatterns = defaultImportPatterns
      } = options;

      // Find all source files
      const srcFiles: string[] = glob.sync(patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]);
      console.log(`Analyzing ${srcFiles.length} files...`);

      // Maps to store analysis data
      const allImports: Map<string, string[]> = new Map();
      const importedByMap: Map<string, string[]> = new Map();

      // Initialize importedByMap
      srcFiles.forEach(file => {
        importedByMap.set(file, []);
      });

      // Process imports for each file
      srcFiles.forEach(file => {
        const content: string = fs.readFileSync(file, 'utf8');
        const imports: string[] = parseImports(content, file, importPatterns);

        // Handle app.provide patterns
        processAppProvides(
          file, 
          content, 
          srcFiles, 
          imports, 
          importPatterns.appProvideImport || defaultImportPatterns.appProvideImport
        );

        // Store imports
        allImports.set(file, imports);
      });

      // Build reverse mapping (which files are imported by others)
      allImports.forEach((imports, importingFile) => {
        imports.forEach(importedPath => {
          const normalizedPath = path.normalize(importedPath);

          srcFiles.forEach(srcFile => {
            const absoluteSrcPath = path.resolve(srcFile);
            if (
              absoluteSrcPath.endsWith(normalizedPath) ||
              normalizedPath.endsWith(srcFile) ||
              path.basename(absoluteSrcPath) === path.basename(normalizedPath) ||
              (srcFile.includes('/services/') &&
                (normalizedPath.includes(path.basename(srcFile)) || 
                srcFile.includes(path.basename(normalizedPath))))
            ) {
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
      const fileAnalysis: FileAnalysis = { files: [] };
      
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
      const summary: Summary = {
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
        fs.writeFileSync(
          path.join(outputDir, 'file-analysis.json'), 
          JSON.stringify(fileAnalysis, null, 2), 
          'utf-8'
        );
        
        // Write table format for UI
        const tableData = fileAnalysis.files.map(file => ({
          filePath: file.path,
          fileType: file.type,
          isUsed: file.isUsed ? 'Yes' : 'No',
          importCount: file.importCount
        }));
        
        fs.writeFileSync(
          path.join(outputDir, 'file-analysis-table.json'), 
          JSON.stringify(tableData, null, 2), 
          'utf-8'
        );
        
        // Write summary
        fs.writeFileSync(
          path.join(outputDir, 'file-analysis-summary.json'), 
          JSON.stringify(summary, null, 2), 
          'utf-8'
        );
        
        // Write markdown
        fs.writeFileSync(
          path.join(outputDir, 'file-analysis.md'), 
          markdown, 
          'utf-8'
        );
        
        console.log(`Analysis results have been saved to ${outputDir}`);
      }

      resolve({
        analysis: fileAnalysis,
        summary,
        markdown
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Run the analyzer with command line arguments
 */
export function runFromCommandLine() {
  const args = process.argv.slice(2);
  const options: AnalyzerOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--src' && args[i+1]) {
      options.src = args[i+1];
      i++;
    } else if (args[i] === '--patterns' && args[i+1]) {
      options.patterns = args[i+1].split(',');
      i++;
    } else if (args[i] === '--main' && args[i+1]) {
      options.mainJsPattern = args[i+1];
      i++;
    } else if (args[i] === '--output' && args[i+1]) {
      options.outputDir = args[i+1];
      i++;
    } else if (args[i] === '--no-files') {
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