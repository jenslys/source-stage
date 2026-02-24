import { parseArgs, HELP_TEXT } from "./ai-commit-eval/args"
import { resolveAiConfig } from "./ai-commit-eval/config"
import { evaluateCommit } from "./ai-commit-eval/evaluate-commit"
import { evaluateWorkingTree } from "./ai-commit-eval/evaluate-working-tree"
import { printResults } from "./ai-commit-eval/output"
import type { EvalResult, GitEvalOptions } from "./ai-commit-eval/types"
import { loadStageConfig } from "./config"

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2)
  const options = parseArgs(cliArgs)

  if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
    console.log(HELP_TEXT)
    return
  }

  const cwd = process.cwd()
  const resolvedConfig = await loadStageConfig(cwd)
  const aiConfig = resolveAiConfig(resolvedConfig.config.ai, options)
  const gitOptions: GitEvalOptions = {
    historyLimit: resolvedConfig.config.history.limit,
    hideWhitespaceChanges: resolvedConfig.config.ui.hideWhitespaceChanges,
    autoStageOnCommit: resolvedConfig.config.git.autoStageOnCommit,
  }

  const results: EvalResult[] = []
  if (options.commits.length > 0) {
    for (const commit of options.commits) {
      const result = await evaluateCommit({
        repoCwd: cwd,
        commit,
        selectedPathsOverride: options.paths,
        keepWorktree: options.keepWorktrees,
        aiConfig,
        gitOptions,
      })
      results.push(result)
    }
  } else {
    const result = await evaluateWorkingTree({
      cwd,
      selectedPathsOverride: options.paths,
      aiConfig,
      gitOptions,
    })
    results.push(result)
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  printResults(results, { verbose: options.verbose })
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`AI eval failed: ${message}`)
  process.exit(1)
})
