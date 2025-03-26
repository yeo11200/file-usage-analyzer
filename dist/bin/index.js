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
// file-analyzer.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = __importDefault(require("glob"));
// 모든 소스 파일 가져오기
const srcFiles = glob_1.default.sync('src/**/*.{js,vue,ts}');
console.log(`총 ${srcFiles.length}개의 파일을 분석합니다...`);
// 결과 저장할 객체
const fileAnalysis = {
    files: [],
};
// 파일 유형 판별 함수
function getFileType(filePath) {
    if (filePath.includes('/services/'))
        return 'service';
    if (filePath.includes('/components/'))
        return 'component';
    if (filePath.includes('/views/'))
        return 'view';
    if (filePath.includes('/store/'))
        return 'store';
    if (filePath.includes('/utils/'))
        return 'utility';
    if (filePath.includes('/router/'))
        return 'router';
    if (filePath.includes('/assets/'))
        return 'asset';
    if (filePath.includes('/constants/'))
        return 'constant';
    return 'other';
}
// 모든 파일의 임포트 데이터 추적
const allImports = new Map(); // 키: 파일 경로, 값: 임포트하는 다른 파일 배열
// 임포트 패턴 찾기
srcFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const absolutePath = path.resolve(file);
    // 임포트 목록 (이 파일이 임포트하는 다른 파일들)
    const imports = [];
    // 정적 임포트 찾기 - 더 많은 패턴 포함
    const staticImports = content.match(/import .+ from ['"](.+)['"]/g) || [];
    // 이름만 있는 임포트 찾기
    const namedImports = content.match(/import ['"](.+)['"]/g) || [];
    // 동적 임포트 찾기
    const lazyImports = content.match(/import\(['"](.+)['"]\)/g) || [];
    const routerImports = content.match(/component: \(\) => import\(['"](.+)['"]\)/g) || [];
    // provide/inject 패턴 찾기
    const provideImports = content.match(/provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g) || [];
    const appProvideImports = content.match(/app\.provide\(['"][^'"]+['"], [^)]*?['"]([@/][^'"]+)['"]/g) || [];
    // main.js에서 app.provide 특별 처리
    const appProvideDirectMatches = [];
    if (file.includes('main.js')) {
        const appProvideDirectPattern = /app\.provide\(['"]([^'"]+)['"], [^)]+\)/g;
        let match;
        while ((match = appProvideDirectPattern.exec(content)) !== null) {
            appProvideDirectMatches.push(match[1]);
        }
    }
    // Vue에서 직접 컴포넌트 등록 패턴
    const vueComponentImports = content.match(/components: {[^}]*['"]([^'"]+)['"]/g) || [];
    // 서비스 특화 패턴 찾기
    const serviceMatches = content.match(/from ['"](@\/services\/[^'"]+)['"]/g) || [];
    serviceMatches.forEach((serviceImport) => {
        const match = serviceImport.match(/from ['"](@\/services\/[^'"]+)['"]/);
        if (match && match[1]) {
            const servicePath = match[1];
            let importPath = servicePath.replace('@/', 'src/');
            imports.push(importPath);
            imports.push(`${importPath}.js`);
            // 중첩 폴더 구조 처리 (예: sessionStorage/session-storage.service)
            if (importPath.includes('/')) {
                const parts = importPath.split('/');
                const fileName = parts.pop();
                const parentDir = parts.join('/');
                // 다양한 파일 이름 패턴 처리
                imports.push(`${parentDir}/${fileName}.js`);
                imports.push(`${parentDir}/${fileName}/index.js`);
                imports.push(`${parentDir}/${fileName}/Index.js`);
                // 서비스 파일의 다양한 네이밍 규칙 처리
                if (fileName.includes('.')) {
                    const nameParts = fileName.split('.');
                    imports.push(`${parentDir}/${nameParts[0]}.js`);
                    imports.push(`${parentDir}/${nameParts[0]}/index.js`);
                }
            }
        }
    });
    // 모든 임포트 패턴 처리
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
            // node_modules은 제외
            if (!importPath.includes('node_modules')) {
                // @/ 경로 처리
                if (importPath.startsWith('@/')) {
                    importPath = importPath.replace('@/', 'src/');
                }
                // 확장자 추가 및 처리
                if (!path.extname(importPath) && !importPath.endsWith('/')) {
                    // 가능한 경로 후보들
                    const possiblePaths = [
                        `${importPath}.vue`,
                        `${importPath}.js`,
                        `${importPath}.ts`,
                        `${importPath}/index.vue`,
                        `${importPath}/Index.vue`,
                    ];
                    // api 폴더 경로 양쪽 버전 추가
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
                        // 중첩 폴더 구조 처리 (예: sessionStorage/session-storage.service)
                        const serviceParts = importPath.split('/services/');
                        if (serviceParts.length > 1) {
                            const servicePath = serviceParts[1];
                            possiblePaths.push(`src/services/${servicePath}.js`);
                            // 다양한 폴더/파일 구조 처리
                            if (servicePath.includes('/')) {
                                const subParts = servicePath.split('/');
                                const subFileName = subParts.pop();
                                const subDir = subParts.join('/');
                                possiblePaths.push(`src/services/${subDir}/${subFileName}.js`);
                                possiblePaths.push(`src/services/${subDir}/${subFileName}/index.js`);
                                possiblePaths.push(`src/services/${subDir}/${subFileName}/Index.js`);
                                // 파일명 변형 처리
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
    // main.js의 app.provide 특별 처리 (서비스 사용 파일 매핑)
    if (appProvideDirectMatches.length > 0) {
        // 서비스 파일 후보들
        const serviceFiles = srcFiles.filter((f) => f.includes('/services/'));
        appProvideDirectMatches.forEach((provideKey) => {
            // 일반적인 서비스 명명 규칙 ($localStorage -> local-storage.service.js)
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
    // 임포트 맵에 저장
    allImports.set(file, imports);
});
// 사용 여부 추적을 위한 역방향 맵 구성 (어떤 파일이 어디서 임포트되는지)
const importedByMap = new Map(); // 키: 파일 경로, 값: 이 파일을 임포트하는 다른 파일 배열
// 모든 소스 파일을 역방향 맵에 초기화
srcFiles.forEach((file) => {
    importedByMap.set(file, []);
});
// 역방향 맵 채우기
allImports.forEach((imports, importingFile) => {
    imports.forEach((importedPath) => {
        // 정규화된 경로 얻기
        const normalizedPath = path.normalize(importedPath);
        // 모든 소스 파일을 순회하며 매칭되는 파일 찾기
        srcFiles.forEach((srcFile) => {
            const absoluteSrcPath = path.resolve(srcFile);
            if (absoluteSrcPath.endsWith(normalizedPath) ||
                normalizedPath.endsWith(srcFile) ||
                path.basename(absoluteSrcPath) === path.basename(normalizedPath) ||
                // 서비스 파일 특별 처리
                (srcFile.includes('/services/') &&
                    (normalizedPath.includes(path.basename(srcFile)) || srcFile.includes(path.basename(normalizedPath))))) {
                // 현재 파일을 임포트하는 파일 목록에 추가
                const importedBy = importedByMap.get(srcFile) || [];
                if (!importedBy.includes(importingFile)) {
                    importedBy.push(importingFile);
                    importedByMap.set(srcFile, importedBy);
                }
            }
        });
    });
});
// main.js를 특별 처리 (전역 상태 관리)
const mainJsFile = srcFiles.find((f) => f.endsWith('main.js'));
if (mainJsFile) {
    const content = fs.readFileSync(mainJsFile, 'utf8');
    // app.provide 찾기
    const providePattern = /app\.provide\(['"]([$][^'"]+)['"], ([^)]+)\)/g;
    let match;
    while ((match = providePattern.exec(content)) !== null) {
        const provideKey = match[1]; // 예: $localStorage
        // const provideValue = match[2]; // 사용되지 않음
        // 서비스 파일 찾기
        if (provideKey.startsWith('$')) {
            const serviceName = provideKey.substring(1);
            const kebabServiceName = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            // 해당하는 서비스 파일 찾기
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
// 최종 결과 생성
srcFiles.forEach((file) => {
    const importedBy = importedByMap.get(file) || [];
    fileAnalysis.files.push({
        path: file,
        type: getFileType(file),
        isUsed: importedBy.length > 0,
        importCount: importedBy.length,
        importedBy: importedBy,
    });
});
// 결과를 JSON 파일로 저장
fs.writeFileSync('file-analysis.json', JSON.stringify(fileAnalysis, null, 2), 'utf-8');
console.log('분석 결과가 file-analysis.json 파일에 저장되었습니다.');
// 테이블 데이터용 간소화 버전 생성
const tableData = fileAnalysis.files.map((file) => ({
    filePath: file.path,
    fileType: file.type,
    isUsed: file.isUsed ? 'Yes' : 'No',
    importCount: file.importCount,
}));
fs.writeFileSync('file-analysis-table.json', JSON.stringify(tableData, null, 2), 'utf-8');
console.log('테이블용 데이터가 file-analysis-table.json 파일에 저장되었습니다.');
// 유형별 요약 데이터
const summary = {
    total: srcFiles.length,
    used: fileAnalysis.files.filter((f) => f.isUsed).length,
    unused: fileAnalysis.files.filter((f) => !f.isUsed).length,
    byType: {},
};
// 유형별 통계
const types = Array.from(new Set(fileAnalysis.files.map((f) => f.type)));
types.forEach((type) => {
    const typeFiles = fileAnalysis.files.filter((f) => f.type === type);
    summary.byType[type] = {
        total: typeFiles.length,
        used: typeFiles.filter((f) => f.isUsed).length,
        unused: typeFiles.filter((f) => !f.isUsed).length,
    };
});
fs.writeFileSync('file-analysis-summary.json', JSON.stringify(summary, null, 2), 'utf-8');
console.log('요약 데이터가 file-analysis-summary.json 파일에 저장되었습니다.');
// 마크다운 테이블 생성
let markdown = '# 파일 사용 분석 결과\n\n';
// 요약 정보
markdown += '## 요약\n\n';
markdown += `- 전체 파일: ${summary.total}\n`;
markdown += `- 사용 중인 파일: ${summary.used}\n`;
markdown += `- 사용되지 않는 파일: ${summary.unused}\n\n`;
// 유형별 요약
markdown += '## 유형별 통계\n\n';
markdown += '| 파일 유형 | 전체 | 사용 중 | 미사용 |\n';
markdown += '|----------|------|---------|--------|\n';
Object.entries(summary.byType).forEach(([type, stats]) => {
    markdown += `| ${type} | ${stats.total} | ${stats.used} | ${stats.unused} |\n`;
});
// 미사용 파일 목록
markdown += '\n## 미사용 파일 목록\n\n';
markdown += '| 파일 경로 | 유형 |\n';
markdown += '|-----------|------|\n';
fileAnalysis.files
    .filter((file) => !file.isUsed)
    .forEach((file) => {
    markdown += `| ${file.path} | ${file.type} |\n`;
});
// 마크다운 파일로 저장
fs.writeFileSync('file-analysis.md', markdown, 'utf-8');
console.log('마크다운 파일이 생성되었습니다: file-analysis.md');
//# sourceMappingURL=index.js.map