import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface CodeAnalysisResult {
  hasErrors: boolean;
  errorCount: number;
  hasWarnings: boolean;
  warningCount: number;
  lineCount: number;
  complexity: number;
  quality: "good" | "improving" | "needs_work";
  lastError?: string;
  lastWarning?: string;
  lastSuccess?: string;
}

export class CodeAnalyzer {
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private currentFile: string | undefined;
  private analysisResults: Map<string, CodeAnalysisResult> = new Map();
  private onEmotionChange:
    | ((emotion: string, reason: string) => void)
    | undefined;

  constructor() {
    console.log("CodeAnalyzer initialized");
    this.setupFileWatcher();
  }

  public setEmotionCallback(
    callback: (emotion: string, reason: string) => void
  ): void {
    this.onEmotionChange = callback;
  }

  private setupFileWatcher(): void {
    console.log("🔧 Setting up file watchers...");

    // Watch for active text editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.isPythonFile(editor.document)) {
        console.log(`📁 Active editor changed to: ${editor.document.fileName}`);
        this.currentFile = editor.document.fileName;
        this.analyzeFile(editor.document);
      }
    });

    // Watch for document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        this.isPythonFile(event.document) &&
        event.document === vscode.window.activeTextEditor?.document
      ) {
        console.log(`✏️ Document changed: ${event.document.fileName}`);
        this.analyzeFile(event.document);
      }
    });

    // Watch for document saves
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (this.isPythonFile(document)) {
        console.log(`💾 Document saved: ${document.fileName}`);
        this.analyzeFile(document);
      }
    });

    console.log("✅ File watchers set up successfully");

    // Perform initial analysis for the currently active editor (if any)
    const active = vscode.window.activeTextEditor;
    if (active && this.isPythonFile(active.document)) {
      this.currentFile = active.document.fileName;
      this.analyzeFile(active.document);
    }
  }

  private isPythonFile(document: vscode.TextDocument): boolean {
    return (
      document.languageId === "python" || document.fileName.endsWith(".py")
    );
  }

  private async analyzeFile(document: vscode.TextDocument): Promise<void> {
    try {
      console.log(`🔍 Analyzing file: ${document.fileName}`);
      const content = document.getText();
      const result = await this.analyzePythonCode(content);

      console.log(`📊 Analysis result:`, result);

      // Track current file being analyzed
      this.currentFile = document.fileName;

      // Compare against previous results BEFORE updating the cache
      const previous = this.analysisResults.get(document.fileName);

      // Update cache first so consumers can read the latest
      this.analysisResults.set(document.fileName, result);

      // Notify UI based on diff with previous
      this.updateBotEmotion(result, document.fileName, previous);
    } catch (error) {
      console.error("Error analyzing Python file:", error);
    }
  }

  private async analyzePythonCode(
    content: string
  ): Promise<CodeAnalysisResult> {
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    const lineCount = lines.length;

    // Basic syntax analysis
    const syntaxErrors = this.checkPythonSyntax(content);
    const hasErrors = syntaxErrors.length > 0;
    const errorCount = syntaxErrors.length;

    // Basic warnings analysis (style/quality hints)
    const warnings = this.checkPythonWarnings(content);
    const hasWarnings = warnings.length > 0;
    const warningCount = warnings.length;

    // Code quality analysis
    const complexity = this.calculateComplexity(lines);
    const quality = this.assessCodeQuality(lines, complexity, errorCount);

    // Get last messages
    const lastError = hasErrors ? syntaxErrors[0] : undefined;
    const lastWarning = hasWarnings ? warnings[0] : undefined;
    const lastSuccess =
      !hasErrors && lineCount > 0 ? "Code looks good!" : undefined;

    return {
      hasErrors,
      errorCount,
      hasWarnings,
      warningCount,
      lineCount,
      complexity,
      quality,
      lastError,
      lastWarning,
      lastSuccess,
    };
  }

  private checkPythonSyntax(content: string): string[] {
    const errors: string[] = [];

    // Basic Python syntax checks
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for common Python syntax issues
      if (line.includes("print(") && !line.includes(")")) {
        errors.push(
          `Line ${lineNumber}: Missing closing parenthesis in print statement`
        );
      }

      if (
        line.includes("if ") &&
        !line.includes(":") &&
        line.trim().length > 0
      ) {
        errors.push(`Line ${lineNumber}: Missing colon after if statement`);
      }

      if (
        line.includes("def ") &&
        !line.includes(":") &&
        line.trim().length > 0
      ) {
        errors.push(
          `Line ${lineNumber}: Missing colon after function definition`
        );
      }

      if (
        line.includes("for ") &&
        !line.includes(":") &&
        line.trim().length > 0
      ) {
        errors.push(`Line ${lineNumber}: Missing colon after for loop`);
      }

      if (
        line.includes("while ") &&
        !line.includes(":") &&
        line.trim().length > 0
      ) {
        errors.push(`Line ${lineNumber}: Missing colon after while loop`);
      }

      if (line.includes("try:") && !this.hasMatchingExcept(lines, i)) {
        errors.push(`Line ${lineNumber}: try block without matching except`);
      }

      // Check for unmatched quotes
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        errors.push(`Line ${lineNumber}: Unmatched quotes`);
      }

      // Check for undefined variables (basic check)
      if (
        line.includes("=") &&
        line.includes("+") &&
        line.includes("undefined")
      ) {
        errors.push(`Line ${lineNumber}: Possible undefined variable usage`);
      }
    }

    return errors;
  }

  private hasMatchingExcept(lines: string[], tryLineIndex: number): boolean {
    for (let i = tryLineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("except")) {
        return true;
      }
      if (
        lines[i].trim().startsWith("def ") ||
        lines[i].trim().startsWith("class ")
      ) {
        break;
      }
    }
    return false;
  }

  private calculateComplexity(lines: string[]): number {
    let complexity = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Increase complexity for control structures
      if (trimmed.startsWith("if ") || trimmed.startsWith("elif "))
        complexity += 1;
      if (trimmed.startsWith("for ") || trimmed.startsWith("while "))
        complexity += 2;
      if (trimmed.startsWith("try:") || trimmed.startsWith("except "))
        complexity += 1;
      if (trimmed.startsWith("def ") || trimmed.startsWith("class "))
        complexity += 1;
      if (trimmed.includes(" and ") || trimmed.includes(" or "))
        complexity += 1;
      if (trimmed.includes("lambda ")) complexity += 2;

      // Nested structures increase complexity more
      const indentLevel = line.length - line.trimStart().length;
      if (indentLevel > 8) complexity += 1;
    }

    return complexity;
  }

  private checkPythonWarnings(content: string): string[] {
    const warnings: string[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Long line warning (>120 chars)
      if (line.length > 120) {
        warnings.push(`Line ${lineNumber}: Line exceeds 120 characters`);
      }
      // Trailing whitespace
      if (/\s+$/.test(line) && line.trim().length > 0) {
        warnings.push(`Line ${lineNumber}: Trailing whitespace`);
      }
      // TODO/FIXME notes
      if (/\b(TODO|FIXME)\b/.test(line)) {
        warnings.push(
          `Line ${lineNumber}: Contains ${
            line.match(/\b(TODO|FIXME)\b/)?.[0]
          } note`
        );
      }
      // Tab indentation (PEP8 prefers spaces)
      if (/^\t+/.test(line)) {
        warnings.push(
          `Line ${lineNumber}: Uses tab indentation (prefer spaces)`
        );
      }
      // Mixed indentation (tabs + spaces at start)
      if (/^(\t+ +| +\t+)/.test(line)) {
        warnings.push(
          `Line ${lineNumber}: Mixed indentation (tabs and spaces)`
        );
      }
    }

    return warnings;
  }

  private assessCodeQuality(
    lines: string[],
    complexity: number,
    errorCount: number
  ): "good" | "improving" | "needs_work" {
    if (errorCount === 0 && complexity < 10 && lines.length > 0) {
      return "good";
    } else if (errorCount === 0 && lines.length > 0) {
      return "improving";
    } else {
      return "needs_work";
    }
  }

  private updateBotEmotion(
    result: CodeAnalysisResult,
    fileName: string,
    previousResult?: CodeAnalysisResult
  ): void {
    if (!this.onEmotionChange) return;

    let emotion: string;
    let reason: string;

    if (result.hasErrors) {
      emotion = "frustrated";
      reason = `Found ${result.errorCount} syntax error(s) in ${path.basename(
        fileName
      )}`;
    } else if (result.hasWarnings) {
      emotion = "concerned";
      reason = `Warnings detected in ${path.basename(fileName)}`;
    } else if (result.lineCount === 0) {
      emotion = "happy";
      reason = "Empty file - ready to start coding!";
    } else {
      emotion = "happy";
      reason = `Great code! ${result.lineCount} lines written, no errors found`;
    }

    // Only trigger emotion change if it's different or significant
    const baseline = previousResult ?? this.analysisResults.get(fileName);
    if (
      !baseline ||
      baseline.hasErrors !== result.hasErrors ||
      baseline.errorCount !== result.errorCount ||
      baseline.lineCount !== result.lineCount
    ) {
      console.log(`🎭 Emotion change: ${emotion} - ${reason}`);
      this.onEmotionChange(emotion, reason);
    }
  }

  public getCurrentAnalysis(): CodeAnalysisResult | undefined {
    if (!this.currentFile) return undefined;
    return this.analysisResults.get(this.currentFile);
  }

  public getAllAnalysisResults(): Map<string, CodeAnalysisResult> {
    return this.analysisResults;
  }

  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }
}
