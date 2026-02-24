import { normalizeBranchName } from "../git-branch-name"
import type { RunGit } from "./types"

export async function fetchRepo(runGit: RunGit): Promise<void> {
  await runGit(["fetch", "--prune"])
}

export async function pullRepo(runGit: RunGit): Promise<void> {
  await runGit(["pull", "--ff-only"])
}

export async function pullRepoMerge(runGit: RunGit): Promise<void> {
  await runGit(["pull", "--no-rebase"])
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

export async function hasWorkingTreeChanges(runGit: RunGit): Promise<boolean> {
  const result = await runGit(["status", "--porcelain"])
  return result.stdout.trim().length > 0
}

export async function isMergeInProgress(runGit: RunGit): Promise<boolean> {
  const result = await runGit(["rev-parse", "-q", "--verify", "MERGE_HEAD"], {
    expectedCodes: [0, 1],
  })
  return result.code === 0
}

export async function markConflictResolved(path: string, runGit: RunGit): Promise<void> {
  const normalizedPath = path.trim()
  if (!normalizedPath) {
    throw new Error("Conflict file path is required.")
  }
  await runGit(["add", "--", normalizedPath])
}

export async function completeMergeCommit(runGit: RunGit): Promise<void> {
  const mergeInProgress = await isMergeInProgress(runGit)
  if (!mergeInProgress) {
    throw new Error("No merge is in progress.")
  }

  const unresolved = await runGit(["diff", "--name-only", "--diff-filter=U", "-z"])
  const unresolvedPaths = unresolved.stdout
    .split("\u0000")
    .map((value) => value.trim())
    .filter(Boolean)
  if (unresolvedPaths.length > 0) {
    throw new Error(
      `Resolve all merge conflicts before completing merge (${unresolvedPaths.length} unresolved).`,
    )
  }

  await runGit(["commit", "--no-edit"])
}

export async function abortMerge(runGit: RunGit): Promise<void> {
  const mergeInProgress = await isMergeInProgress(runGit)
  if (!mergeInProgress) {
    throw new Error("No merge is in progress.")
  }
  await runGit(["merge", "--abort"])
}

export async function mergeRemoteMain(runGit: RunGit): Promise<string> {
  await fetchRepo(runGit)
  const target = await resolveRemoteMainRef(runGit)
  await runGit(["merge", "--no-edit", target])
  return target
}

export async function checkoutBranch(branch: string, runGit: RunGit): Promise<void> {
  if (!branch.trim()) {
    throw new Error("Branch name is required.")
  }
  await runGit(["checkout", branch])
}

export async function deleteLocalBranch(branch: string, runGit: RunGit): Promise<void> {
  const normalizedBranch = branch.trim()
  if (!normalizedBranch) {
    throw new Error("Branch name is required.")
  }

  const currentBranchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"])
  const currentBranch = currentBranchResult.stdout.trim()
  if (currentBranch === normalizedBranch) {
    throw new Error("Cannot delete the current branch.")
  }

  await runGit(["branch", "-d", normalizedBranch])
}

export async function deleteRemoteBranch(branch: string, runGit: RunGit): Promise<void> {
  const normalizedBranch = branch.trim()
  if (!normalizedBranch) {
    throw new Error("Branch name is required.")
  }

  const remoteResult = await runGit(["remote"])
  const remotes = remoteResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (!remotes.includes("origin")) {
    throw new Error("Remote 'origin' was not found.")
  }

  await runGit(["push", "origin", "--delete", normalizedBranch])
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

export async function popStashRef(stashRef: string, runGit: RunGit): Promise<void> {
  const normalizedRef = stashRef.trim()
  if (!normalizedRef) {
    throw new Error("Stash reference is required.")
  }

  const restoreResult = await runGit(["stash", "pop", normalizedRef], { expectedCodes: [0, 1] })
  if (restoreResult.code !== 0) {
    const details = restoreResult.stderr || restoreResult.stdout || "Unknown error."
    throw new Error(`Failed to restore stashed changes from ${normalizedRef}: ${details}`)
  }
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

async function resolveRemoteMainRef(runGit: RunGit): Promise<string> {
  const remoteHead = await runGit(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], {
    expectedCodes: [0, 1, 128],
  })
  if (remoteHead.code === 0) {
    const fullRef = remoteHead.stdout.trim()
    const remoteRef = fullRef.replace(/^refs\/remotes\//, "")
    if (remoteRef) {
      return remoteRef
    }
  }

  for (const candidate of ["origin/main", "origin/master"]) {
    const verify = await runGit(["rev-parse", "--verify", candidate], { expectedCodes: [0, 128] })
    if (verify.code === 0) {
      return candidate
    }
  }

  throw new Error(
    "Unable to resolve remote main branch. Expected origin/HEAD, origin/main, or origin/master.",
  )
}
