import * as ts from 'typescript'

let compilerOptions: ts.CompilerOptions | null = null

function getCompilerOptions(): ts.CompilerOptions {
  if (!compilerOptions) {
    compilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      jsx: ts.JsxEmit.Preserve,
      strict: false,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      removeComments: false,
      isolatedModules: true,
      noEmit: false,
      sourceMap: false,
      inlineSourceMap: false
    }
  }
  return compilerOptions
}

export function useTsCompiler() {
  function transpile(code: string, fileName = 'codestage.ts'): { output: string; diagnostics: ts.Diagnostic[] } {
    const result = ts.transpileModule(code, {
      compilerOptions: getCompilerOptions(),
      fileName,
      reportDiagnostics: true
    })
    return {
      output: result.outputText || '',
      diagnostics: result.diagnostics || []
    }
  }

  function stripTypeAnnotations(code: string): string {
    return transpile(code).output
  }

  function checkSyntax(code: string, fileName = 'codestage.ts'): ts.Diagnostic[] {
    const sourceFile = ts.createSourceFile(
      fileName,
      code,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS
    )
    const diagnostics: ts.Diagnostic[] = []
    const program = ts.createProgram({
      rootNames: [fileName],
      options: getCompilerOptions(),
      host: {
        ...ts.createCompilerHost(getCompilerOptions()),
        getSourceFile: (name: string) => name === fileName ? sourceFile : undefined,
        readFile: () => undefined,
        fileExists: (name: string) => name === fileName,
        writeFile: () => {}
      } as any
    })
    const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile)
    diagnostics.push(...syntacticDiagnostics)
    return diagnostics
  }

  function formatDiagnostics(diagnostics: ts.Diagnostic[]): string {
    return diagnostics
      .filter(d => d.category === ts.DiagnosticCategory.Error)
      .map(d => {
        const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
        if (d.file && d.start !== undefined) {
          const { line, character } = d.file.getLineAndCharacterOfPosition(d.start)
          return `第 ${line + 1} 行 第 ${character + 1} 列: ${msg}`
        }
        return msg
      })
      .join('\n')
  }

  function isTypeScript(language: string): boolean {
    return language === 'typescript' || language === 'ts'
  }

  return {
    transpile,
    stripTypeAnnotations,
    checkSyntax,
    formatDiagnostics,
    isTypeScript
  }
}

export type TsCompilerAPI = ReturnType<typeof useTsCompiler>
