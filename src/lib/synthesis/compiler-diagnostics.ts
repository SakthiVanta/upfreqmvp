/**
 * ROS 2 Compiler Diagnostics & Auto-Fix Feedback Loop
 * Parses colcon build compiler outputs, extracts structured diagnostic tokens,
 * and formulates automated repair strategies.
 */

export interface CompilerDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'fatal error';
  message: string;
  codeSnippet?: string;
  suggestedFix?: string;
}

export interface BuildDiagnosticReport {
  success: boolean;
  package: string;
  errorCount: number;
  warningCount: number;
  diagnostics: CompilerDiagnostic[];
  autoFixAvailable: boolean;
  remediationPlan?: string;
}

export function parseCompilerOutput(packageName: string, rawOutput: string): BuildDiagnosticReport {
  const diagnostics: CompilerDiagnostic[] = [];

  // Match GCC/Clang standard error format:
  // /path/to/file.cpp:42:15: error: 'undefined_var' was not declared in this scope
  const errorRegex = /([a-zA-Z0-9_./\\-]+\.(?:cpp|hpp|c|h|py)):(\d+):(\d+):\s+(error|fatal error|warning):\s+(.+)/g;

  const matches = rawOutput.matchAll(errorRegex);
  for (const m of matches) {
    const file = m[1];
    const line = parseInt(m[2], 10);
    const col = parseInt(m[3], 10);
    const severity = m[4] as any;
    const msg = m[5];

    let suggestedFix: string | undefined;
    if (msg.includes('was not declared in this scope')) {
      suggestedFix = 'Verify include headers or check variable spelling';
    } else if (msg.includes('no matching function for call')) {
      suggestedFix = 'Verify argument types match ROS 2 API signatures';
    } else if (msg.includes('No such file or directory')) {
      suggestedFix = 'Ensure package dependency is declared in package.xml and find_package in CMakeLists.txt';
    }

    diagnostics.push({
      file,
      line,
      column: col,
      severity,
      message: msg,
      suggestedFix,
    });
  }

  const errorCount = diagnostics.filter(d => d.severity.includes('error')).length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

  return {
    success: errorCount === 0,
    package: packageName,
    errorCount,
    warningCount,
    diagnostics,
    autoFixAvailable: errorCount > 0,
    remediationPlan: errorCount > 0
      ? `Auto-fix agent will address ${errorCount} compiler error(s) by patching headers and argument signatures.`
      : undefined,
  };
}
