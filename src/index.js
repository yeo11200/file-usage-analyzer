/**
 * 파일 사용 분석기 (JavaScript 버전)
 * TypeScript 버전의 코드를 JavaScript로 변환한 파일입니다.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Default configurations
const defaultFileTypeMapping = {
  '/services/': 'service',
  '/components/': 'component',
  '/views/': 'view',
  '/store/': 'store',
  '/utils/': 'utility',
  '/router/': 'router',
  '/assets/': 'asset',
  '/constants/': 'constant'
};

const defaultProvidePattern = /app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g;
const defaultMainJsPattern = 'main.js';

// Default import detection patterns
const defaultImportPatterns = {
  staticImport: /import .+ from ['"](.+)['"]/g,
  namedImport: /import ['"](.+)['"]/g,
  lazyImport: /import\(['"](.+)['"]\)/g,
  routerImport: /component: \(\) => import\(['"](.+)['"]\)/g,
  provideImport: /provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
  appProvideImport: /app\.provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g,
  vueComponentImport: /components: {[^}]*['"]([^'"]+)['"]/g,
  serviceImport: /from ['"](@\/services\/[^'"]+)['"]/g,
  barrelImport: /import\s*{[^}]+}\s*from\s*['"]([^'"]+)['"]/g
};

/**
 * 파일 경로를 기반으로 파일 유형을 판별합니다.
 * @param {string} filePath - 분석할 파일 경로
 * @param {Object} typeMapping - 파일 유형 매핑 객체
 * @returns {string} 파일 유형
 */
function getFileType(filePath, typeMapping = defaultFileTypeMapping) {
  for (const key in typeMapping) {
    if (filePath.includes(key)) {
      return typeMapping[key];
    }
  }
  return 'other';
}

/**
 * 파일 내용에서 임포트 구문을 파싱합니다.
 * @param {string} content - 파일 내용
 * @param {string} filePath - 파일 경로 (참고용)
 * @param {Object} patterns - 임포트 패턴 검색을 위한 정규식 객체
 * @returns {string[]} 임포트 경로 배열
 */
function parseImports(content, filePath, patterns = defaultImportPatterns) {
  const imports = [];

  // Regular imports
  const staticImports = content.match(patterns.staticImport || defaultImportPatterns.staticImport) || [];
  const namedImports = content.match(patterns.namedImport || defaultImportPatterns.namedImport) || [];
  const lazyImports = content.match(patterns.lazyImport || defaultImportPatterns.lazyImport) || [];
  const routerImports = content.match(patterns.routerImport || defaultImportPatterns.routerImport) || [];
  const provideImports = content.match(patterns.provideImport || defaultImportPatterns.provideImport) || [];
  const appProvideImports = content.match(patterns.appProvideImport || defaultImportPatterns.appProvideImport) || [];
  const vueComponentImports = content.match(patterns.vueComponentImport || defaultImportPatterns.vueComponentImport) || [];
  
  // 배럴 임포트 (구조 분해 할당 형식)
  const barrelImports = content.match(patterns.barrelImport || defaultImportPatterns.barrelImport) || [];

  // Process service imports specially
  const serviceMatches = content.match(patterns.serviceImport || defaultImportPatterns.serviceImport) || [];
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
  
  // 배럴 패턴 임포트 처리 (먼저 처리하여 우선 적용)
  barrelImports.forEach(importStmt => {
    const match = importStmt.match(/from\s+['"]([^'"]+)['"]/);
    if (match && match[1]) {
      let importPath = match[1];
      
      // node_modules 건너뛰기
      if (importPath.includes('node_modules')) return;
      
      // @/ 경로 처리
      if (importPath.startsWith('@/')) {
        importPath = importPath.replace('@/', 'src/');
      }
      
      // 배럴 파일은 보통 index.js 등을 가리킴
      if (!path.extname(importPath)) {
        imports.push(`${importPath}/index.js`);
        imports.push(`${importPath}/index.ts`);
        imports.push(`${importPath}/index.jsx`);
        imports.push(`${importPath}/index.tsx`);
        imports.push(`${importPath}/index.vue`);
        imports.push(`${importPath}/Index.js`);
        imports.push(`${importPath}/Index.vue`);
      }
      
      // 기본 경로도 추가
      imports.push(importPath);
      if (!path.extname(importPath)) {
        imports.push(`${importPath}.js`);
        imports.push(`${importPath}.ts`);
        imports.push(`${importPath}.jsx`);
        imports.push(`${importPath}.tsx`);
        imports.push(`${importPath}.vue`);
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
    // 이미 위에서 배럴 임포트 처리했으므로 배럴 패턴은 스킵
    if (importStmt.includes('{') && importStmt.includes('}') && importStmt.includes('from')) {
      return;
    }
    
    let match = null;

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
        } else {
          imports.push(importPath);
        }
      }
    }
  });

  // 중복 제거
  return [...new Set(imports)];
}

/**
 * main.js 파일 내의 특수 패턴을 처리합니다.
 * @param {string} mainJsFile - main.js 파일 경로
 * @param {string[]} srcFiles - 소스 파일 경로 배열
 * @param {Map} importedByMap - 누가 어떤 파일을 임포트하는지 매핑
 * @param {RegExp} providePattern - provide 패턴 감지를 위한 정규식
 */
function processMainFile(mainJsFile, srcFiles, importedByMap, providePattern = defaultProvidePattern) {
  if (!mainJsFile) return;
  
  const content = fs.readFileSync(mainJsFile, 'utf8');
  let match;
  
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
 * app.provide 패턴을 처리합니다.
 * @param {string} file - 현재 처리 중인 파일 경로
 * @param {string} content - 파일 내용
 * @param {string[]} srcFiles - 소스 파일 경로 배열
 * @param {string[]} imports - 임포트 경로를 저장할 배열
 * @param {RegExp} appProvidePattern - app.provide 패턴 감지를 위한 정규식
 */
function processAppProvides(file, content, srcFiles, imports, appProvidePattern = /app\.provide\(['"]([^'"]+)['"], [^)]+\)/g) {
  if (!file.includes('main.js')) return;
  
  let match;
  const appProvideDirectMatches = [];
  
  while ((match = appProvidePattern.exec(content)) !== null) {
    appProvideDirectMatches.push(match[1]);
  }

  if (appProvideDirectMatches.length === 0) return;
  
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
 * 주어진 프로젝트의 파일 사용 현황을 분석합니다.
 * @param {Object} options - 분석 옵션
 * @returns {Promise} 분석 결과를 담은 Promise
 */
function analyzeProject(options = {}) {
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
      const srcFiles = glob.sync(patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]);
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
 * 명령줄 인수를 파싱하여 분석기를 실행합니다.
 */
function runFromCommandLine() {
  const args = process.argv.slice(2);
  const options = {};
  
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

// 직접 실행될 때 명령줄 인터페이스 사용
if (require.main === module) {
  runFromCommandLine();
}

// 모듈 내보내기
module.exports = {
  analyzeProject,
  parseImports,
  getFileType,
  processMainFile,
  processAppProvides,
  runFromCommandLine,
  defaultFileTypeMapping,
  defaultProvidePattern,
  defaultMainJsPattern,
  defaultImportPatterns
}; 