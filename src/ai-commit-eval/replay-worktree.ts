import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { runGitRaw } from "../git-process"
import { dedupeNonEmpty } from "./utils"

export async function createReplayWorktree(
  repoCwd: string,
  commit: string,
): Promise<{
  path: string
  commitPaths: string[]
  actualSubject: string
}> {
  const parent = await runGitOrThrow(
    repoCwd,
    ["rev-parse", `${commit}^`],
    `resolve parent for ${commit}`,
  )
  const actualSubject = await runGitOrThrow(
    repoCwd,
    ["show", "-s", "--format=%s", commit],
    `read subject for ${commit}`,
  )
  const commitPathsOutput = await runGitOrThrow(
    repoCwd,
    ["show", "--name-only", "--pretty=format:", commit],
    `read files for ${commit}`,
  )
  const commitPaths = dedupeNonEmpty(commitPathsOutput.split("\n"))
  if (commitPaths.length === 0) {
    throw new Error(`Commit ${commit} has no changed paths to evaluate.`)
  }

  const path = join(tmpdir(), `stage-ai-eval-${commit.slice(0, 8)}-${randomUUID()}`)
  await runGitOrThrow(
    repoCwd,
    ["worktree", "add", "--detach", path, parent.trim()],
    `create replay worktree for ${commit}`,
  )

  try {
    await runGitOrThrow(path, ["cherry-pick", "-n", commit], `replay ${commit}`)
  } catch (error) {
    await removeWorktree(repoCwd, path)
    throw error
  }

  return {
    path,
    commitPaths,
    actualSubject: actualSubject.trim(),
  }
}

export async function removeWorktree(repoCwd: string, worktreePath: string): Promise<void> {
  const result = await runGitRaw(repoCwd, ["worktree", "remove", "--force", worktreePath])
  if (result.code !== 0) {
    const details = result.stderr || result.stdout
    throw new Error(`Failed to remove worktree ${worktreePath}: ${details || "unknown error"}`)
  }
}

async function runGitOrThrow(cwd: string, args: string[], label: string): Promise<string> {
  const result = await runGitRaw(cwd, args)
  if (result.code !== 0) {
    const details = result.stderr || result.stdout
    throw new Error(
      `Failed to ${label}: ${details || `git ${args.join(" ")} exited ${result.code}`}`,
    )
  }
  return result.stdout
}
