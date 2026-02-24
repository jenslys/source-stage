import { normalizeBranchName } from "../git-branch-name"
import type { RunGit } from "./types"

export async function fetchRepo(runGit: RunGit): Promise<void> {
  await runGit(["fetch", "--prune"])
}

export async function pullRepo(runGit: RunGit): Promise<void> {
  await runGit(["pull", "--ff-only"])
}

export async function pushRepo(runGit: RunGit): Promise<void> {
  const hasHeadCommit = await runGit(["rev-parse", "--verify", "HEAD"], {
    expectedCodes: [0, 128],
  })
  if (hasHeadCommit.code !== 0) {
    throw new Error("No commits yet. Create a commit before pushing.")
  }

  const branchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"])
  const branch = branchResult.stdout.trim()
  if (!branch || branch === "HEAD") {
    throw new Error("Cannot push from detached HEAD.")
  }

  const upstreamResult = await runGit(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    { expectedCodes: [0, 1, 128] },
  )
  if (upstreamResult.code === 0) {
    await runGit(["push"])
    return
  }

  const remoteResult = await runGit(["remote"])
  const remotes = remoteResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!remotes.includes("origin")) {
    throw new Error("No upstream configured and remote 'origin' was not found.")
  }

  await runGit(["push", "--set-upstream", "origin", branch])
}

export async function checkoutBranch(branch: string, runGit: RunGit): Promise<void> {
  if (!branch.trim()) {
    throw new Error("Branch name is required.")
  }
  await runGit(["checkout", branch])
}

export async function checkoutCommit(commitHash: string, runGit: RunGit): Promise<void> {
  const hash = commitHash.trim()
  if (!hash) throw new Error("Commit hash is required.")
  await runGit(["checkout", hash])
}

export async function createAndCheckoutBranch(branchName: string, runGit: RunGit): Promise<void> {
  const name = normalizeBranchName(branchName)
  if (!name) {
    throw new Error("Branch name is required.")
  }

  const validation = await runGit(["check-ref-format", "--branch", name], {
    expectedCodes: [0, 1],
  })
  if (validation.code !== 0) {
    throw new Error(`Invalid branch name: ${name}`)
  }

  await runGit(["checkout", "-b", name])
}

export async function revertCommit(commitHash: string, runGit: RunGit): Promise<void> {
  const hash = commitHash.trim()
  if (!hash) throw new Error("Commit hash is required.")
  await runGit(["revert", "--no-edit", hash])
}

export async function commitChanges(
  summary: string,
  description: string,
  excludedPaths: string[],
  includedPaths: string[],
  autoStageOnCommit: boolean,
  runGit: RunGit,
): Promise<void> {
  const title = summary.trim()
  if (!title) {
    throw new Error("Commit summary is required.")
  }

  const selectedPaths = includedPaths.map((path) => path.trim()).filter(Boolean)
  if (selectedPaths.length === 0) {
    throw new Error("No files selected for commit.")
  }

  if (autoStageOnCommit) {
    await runGit(["add", "-A"])
  } else {
    await runGit(["add", "-A", "--", ...selectedPaths])
  }

  const excluded = excludedPaths.map((path) => path.trim()).filter(Boolean)
  if (excluded.length > 0) {
    const stagedExcluded = await runGit([
      "diff",
      "--name-only",
      "--cached",
      "-z",
      "--",
      ...excluded,
    ])
    const stagedExcludedPaths = stagedExcluded.stdout
      .split("\u0000")
      .filter((path) => path.length > 0)
    if (stagedExcludedPaths.length > 0) {
      await runGit(["reset", "--", ...stagedExcludedPaths])
    }
  }

  const hasStagedChanges = await runGit(["diff", "--cached", "--quiet"], { expectedCodes: [0, 1] })
  if (hasStagedChanges.code === 0) {
    throw new Error("No files selected for commit.")
  }

  const args = ["commit", "-m", title]
  if (description.trim()) {
    args.push("-m", description.trim())
  }
  await runGit(args)
}
