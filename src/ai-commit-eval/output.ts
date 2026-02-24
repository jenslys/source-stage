import type { EvalResult } from "./types"

export function printResults(results: EvalResult[]): void {
  for (const [index, result] of results.entries()) {
    console.log(`Result ${index + 1}/${results.length}`)
    console.log(`mode: ${result.mode}`)
    if (result.commit) console.log(`commit: ${result.commit}`)
    if (result.actualSubject) console.log(`actual: ${result.actualSubject}`)
    if (result.worktreePath) console.log(`worktree: ${result.worktreePath}`)
    console.log(`files: ${result.selectedPaths.length}`)
    for (const path of result.selectedPaths) {
      console.log(`- ${path}`)
    }
    console.log(`generated: ${result.generatedSubject}`)
    console.log(`length: ${result.generatedLength}`)
    if (index < results.length - 1) {
      console.log("")
    }
  }
}
