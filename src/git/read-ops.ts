import { parseStatusOutput } from "../git-status-parser"
import type { RepoSnapshot, RunGit, CommitHistoryEntry, CommitFileChange } from "./types"
import { parseBranchRefLines, parseCommitFileChangesNul } from "./parsers"

export async function snapshotRepo(root: string, runGit: RunGit): Promise<RepoSnapshot> {
  const [statusResult, branchesResult] = await Promise.all([
    runGit(["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"]),
    runGit([
      "for-each-ref",
      "--sort=-creatordate",
      "--format=%(refname:short)\t%(creatordate:unix)",
      "refs/heads",
    ]),
  ])

  const parsed = parseStatusOutput(statusResult.stdout)
  const branches = parseBranchRefLines(branchesResult.stdout)

  return {
    root,
    branch: parsed.branch.branch,
    upstream: parsed.branch.upstream,
    ahead: parsed.branch.ahead,
    behind: parsed.branch.behind,
    branches,
    files: parsed.files,
  }
}

export async function diffForFile(
  path: string,
  hideWhitespaceChanges: boolean,
  runGit: RunGit,
): Promise<string> {
  const whitespaceArgs = hideWhitespaceChanges ? ["-w"] : []
  const [unstaged, staged] = await Promise.all([
    runGit(["diff", "--no-color", ...whitespaceArgs, "--", path]),
    runGit(["diff", "--cached", "--no-color", ...whitespaceArgs, "--", path]),
  ])

  const sections: string[] = []
  if (staged.stdout.trim()) {
    sections.push(staged.stdout)
  }
  if (unstaged.stdout.trim()) {
    sections.push(unstaged.stdout)
  }

  if (sections.length > 0) {
    return sections.join("\n")
  }

  const untracked = await runGit(
    ["diff", "--no-index", "--no-color", ...whitespaceArgs, "--", "/dev/null", path],
    { expectedCodes: [0, 1] },
  )
  if (untracked.stdout.trim()) {
    return untracked.stdout
  }

  if (untracked.code !== 0 && untracked.stderr.trim()) {
    throw new Error(untracked.stderr.trim())
  }

  return ""
}

export async function listCommits(limit: number, runGit: RunGit): Promise<CommitHistoryEntry[]> {
  const result = await runGit([
    "log",
    `--max-count=${Math.max(limit, 1)}`,
    "--date=relative",
    "--pretty=format:%H%x1f%h%x1f%s%x1f%ar%x1f%an",
  ])

  if (!result.stdout.trim()) return []

  return result.stdout
    .split("\n")
    .map((line) => line.split("\u001f"))
    .map(([hash, shortHash, subject, relativeDate, author]) => ({
      hash: hash ?? "",
      shortHash: shortHash ?? "",
      subject: subject ?? "(no subject)",
      relativeDate: relativeDate ?? "",
      author: author ?? "",
    }))
    .filter((entry) => entry.hash.length > 0)
}

export async function listCommitFiles(
  commitHash: string,
  runGit: RunGit,
): Promise<CommitFileChange[]> {
  const hash = commitHash.trim()
  if (!hash) throw new Error("Commit hash is required.")

  const result = await runGit([
    "show",
    "--format=",
    "--name-status",
    "-z",
    "--find-renames",
    "--find-copies",
    hash,
  ])

  if (!result.stdout) {
    return []
  }

  return parseCommitFileChangesNul(result.stdout)
}

export async function listMergeConflictPaths(runGit: RunGit): Promise<string[]> {
  const result = await runGit(["diff", "--name-only", "--diff-filter=U", "-z"])
  if (!result.stdout) {
    return []
  }

  return result.stdout
    .split("\u0000")
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function diffForCommitFile(
  commitHash: string,
  path: string,
  hideWhitespaceChanges: boolean,
  runGit: RunGit,
): Promise<string> {
  const hash = commitHash.trim()
  if (!hash) throw new Error("Commit hash is required.")

  const normalizedPath = path.trim()
  if (!normalizedPath) throw new Error("Commit file path is required.")

  const whitespaceArgs = hideWhitespaceChanges ? ["-w"] : []
  const result = await runGit([
    "show",
    "--format=",
    "--patch",
    "--find-renames",
    "--find-copies",
    "--no-color",
    ...whitespaceArgs,
    hash,
    "--",
    normalizedPath,
  ])

  return result.stdout
}
