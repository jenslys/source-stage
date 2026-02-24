import { generateAiCommitSummary } from "../ai-commit"
import type { CommitContextStats } from "../ai-commit"
import type { StageConfig } from "../config"
import { GitClient } from "../git"
import { createReplayWorktree, removeWorktree } from "./replay-worktree"
import { resolveSelectedPaths } from "./selection"
import type { EvalResult, GitEvalOptions } from "./types"

export async function evaluateCommit({
  repoCwd,
  commit,
  selectedPathsOverride,
  keepWorktree,
  aiConfig,
  gitOptions,
}: {
  repoCwd: string
  commit: string
  selectedPathsOverride: string[]
  keepWorktree: boolean
  aiConfig: StageConfig["ai"]
  gitOptions: GitEvalOptions
}): Promise<EvalResult> {
  const replay = await createReplayWorktree(repoCwd, commit)
  try {
    const git = await GitClient.create(replay.path, gitOptions)
    const snapshot = await git.snapshot()
    const selectedPaths = resolveSelectedPaths(
      snapshot.files,
      selectedPathsOverride.length > 0 ? selectedPathsOverride : replay.commitPaths,
    )

    let contextStats: CommitContextStats | undefined
    const summary = await generateAiCommitSummary({
      git,
      files: snapshot.files,
      selectedPaths,
      aiConfig,
      onContextBuilt: (stats) => {
        contextStats = stats
      },
    })

    return {
      mode: "commit",
      commit,
      actualSubject: replay.actualSubject,
      worktreePath: keepWorktree ? replay.path : undefined,
      selectedPaths,
      generatedSubject: summary,
      generatedLength: summary.length,
      contextStats,
    }
  } finally {
    if (!keepWorktree) {
      await removeWorktree(repoCwd, replay.path)
    }
  }
}
