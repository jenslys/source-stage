import { generateAiCommitSummary } from "../ai-commit"
import type { StageConfig } from "../config"
import { GitClient } from "../git"
import type { EvalResult, GitEvalOptions } from "./types"
import { resolveSelectedPaths } from "./selection"

export async function evaluateWorkingTree({
  cwd,
  selectedPathsOverride,
  aiConfig,
  gitOptions,
}: {
  cwd: string
  selectedPathsOverride: string[]
  aiConfig: StageConfig["ai"]
  gitOptions: GitEvalOptions
}): Promise<EvalResult> {
  const git = await GitClient.create(cwd, gitOptions)
  const snapshot = await git.snapshot()
  const selectedPaths = resolveSelectedPaths(snapshot.files, selectedPathsOverride)
  const summary = await generateAiCommitSummary({
    git,
    files: snapshot.files,
    selectedPaths,
    aiConfig,
  })

  return {
    mode: "working",
    selectedPaths,
    generatedSubject: summary,
    generatedLength: summary.length,
  }
}
