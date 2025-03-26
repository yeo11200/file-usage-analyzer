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
    byType: Record<string, {
        total: number;
        used: number;
        unused: number;
    }>;
}
export interface AnalysisResult {
    analysis: FileAnalysis;
    summary: Summary;
    markdown: string;
}
export interface FileTypeMapping {
    [pathPattern: string]: string;
}
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
export declare const defaultFileTypeMapping: FileTypeMapping;
export declare const defaultProvidePattern: RegExp;
export declare const defaultMainJsPattern = "main.js";
export declare const defaultImportPatterns: ImportPatterns;
/**
 * Determine file type based on its path and type mapping
 */
export declare function getFileType(filePath: string, typeMapping?: FileTypeMapping): string;
/**
 * Parse imports from file content
 */
export declare function parseImports(content: string, filePath: string, patterns?: ImportPatterns): string[];
/**
 * Process special patterns in main file
 */
export declare function processMainFile(mainJsFile: string, srcFiles: string[], importedByMap: Map<string, string[]>, providePattern?: RegExp): void;
/**
 * Process app.provide patterns in a file
 */
export declare function processAppProvides(file: string, content: string, srcFiles: string[], imports: string[], appProvidePattern?: RegExp): void;
/**
 * Analyze file usage in the given project
 */
export declare function analyzeProject(options?: AnalyzerOptions): Promise<AnalysisResult>;
/**
 * Run the analyzer with command line arguments
 */
export declare function runFromCommandLine(): void;
