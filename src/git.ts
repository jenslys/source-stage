import { runGitRaw, type GitCommandResult } from "./git-process"
import { normalizeBranchName } from "./git-branch-name"
import { parseBranchLine, parseChangedFiles } from "./git-status-parser"
export type ChangedFile = {
  path: string
  indexStatus: string
  worktreeStatus: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
  statusLabel: string
}

export type RepoSnapshot = {
  root: string
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  branches: string[]
  files: ChangedFile[]
}

export type CommitHistoryEntry = {
  hash: string
  shortHash: string
  subject: string
  relativeDate: string
  author: string
}

export type CommitFileChange = {
  path: string
  status: string
  displayPath: string
}
export type GitClientOptions = {
  hideWhitespaceChanges: boolean
  historyLimit: number
  autoStageOnCommit: boolean
}
const DEFAULT_GIT_CLIENT_OPTIONS: GitClientOptions = {
  hideWhitespaceChanges: true,
  historyLimit: 200,
  autoStageOnCommit: true,
}

export class GitClient {
  private constructor(
    private readonly root: string,
    private readonly options: GitClientOptions,
  ) {}

  static async create(cwd: string, options?: Partial<GitClientOptions>): Promise<GitClient> {
    const rootResult = await runGitRaw(cwd, ["rev-parse", "--show-toplevel"])
    if (rootResult.code !== 0) {
      throw new Error(rootResult.stderr || "Current directory is not a git repository.")
    }
    const root = rootResult.stdout.trim()
    if (!root) {
      throw new Error("Failed to resolve git repository root.")
    }
    return new GitClient(root, {
      hideWhitespaceChanges: options?.hideWhitespaceChanges ?? DEFAULT_GIT_CLIENT_OPTIONS.hideWhitespaceChanges,
      historyLimit: options?.historyLimit ?? DEFAULT_GIT_CLIENT_OPTIONS.historyLimit,
      autoStageOnCommit: options?.autoStageOnCommit ?? DEFAULT_GIT_CLIENT_OPTIONS.autoStageOnCommit,
    })
  }
  async snapshot(): Promise<RepoSnapshot> {
    const [statusResult, branchesResult] = await Promise.all([
      this.runGit(["status", "--porcelain=v1", "--branch", "--untracked-files=all"]),
      this.runGit([
        "for-each-ref",
        "--sort=-creatordate",
        "--format=%(refname:short)\t%(creatordate:unix)",
        "refs/heads",
      ]),
    ])

    const statusLines = statusResult.stdout.split("\n").filter(Boolean)
    const branchInfo = parseBranchLine(statusLines[0] ?? "")
    const files = parseChangedFiles(statusLines.slice(1))
    const branches = sortBranchNames(
      branchesResult.stdout
      .split("\n")
      .map((line) => parseBranchRefLine(line))
      .filter((entry): entry is BranchRef => entry !== null),
    )
      .map((entry) => entry.name)
      .filter(Boolean)

    return {
      root: this.root,
      branch: branchInfo.branch,
      upstream: branchInfo.upstream,
      ahead: branchInfo.ahead,
      behind: branchInfo.behind,
      branches,
      files,
    }
  }

  async diffForFile(path: string): Promise<string> {
    const whitespaceArgs = this.options.hideWhitespaceChanges ? ["-w"] : []
    const [unstaged, staged] = await Promise.all([
      this.runGit(["diff", "--no-color", ...whitespaceArgs, "--", path], true),
      this.runGit(["diff", "--cached", "--no-color", ...whitespaceArgs, "--", path], true),
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

    const untracked = await this.runGit(["diff", "--no-index", "--no-color", ...whitespaceArgs, "--", "/dev/null", path], true)
    if (untracked.stdout.trim()) {
      return untracked.stdout
    }

    return ""
  }

  async fetch(): Promise<void> {
    await this.runGit(["fetch", "--prune"])
  }

  async pull(): Promise<void> {
    await this.runGit(["pull", "--ff-only"])
  }

  async push(): Promise<void> {
    const hasHeadCommit = await this.runGit(["rev-parse", "--verify", "HEAD"], true)
    if (hasHeadCommit.code !== 0) {
      throw new Error("No commits yet. Create a commit before pushing.")
    }

    const branchResult = await this.runGit(["rev-parse", "--abbrev-ref", "HEAD"])
    const branch = branchResult.stdout.trim()
    if (!branch || branch === "HEAD") {
      throw new Error("Cannot push from detached HEAD.")
    }

    const upstreamResult = await this.runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], true)
    if (upstreamResult.code === 0) {
      await this.runGit(["push"])
      return
    }

    const remoteResult = await this.runGit(["remote"], true)
    const remotes = remoteResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    if (!remotes.includes("origin")) {
      throw new Error("No upstream configured and remote 'origin' was not found.")
    }

    await this.runGit(["push", "--set-upstream", "origin", branch])
  }

  async listCommits(limit = this.options.historyLimit): Promise<CommitHistoryEntry[]> {
    const result = await this.runGit([
      "log",
      `--max-count=${Math.max(limit, 1)}`,
      "--date=relative",
      "--pretty=format:%H%x1f%h%x1f%s%x1f%ar%x1f%an",
    ], true)

    if (result.code !== 0) {
      const details = result.stderr || result.stdout
      throw new Error(details || "Failed to load commit history.")
    }
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

  async listCommitFiles(commitHash: string): Promise<CommitFileChange[]> {
    const hash = commitHash.trim()
    if (!hash) throw new Error("Commit hash is required.")

    const result = await this.runGit([
      "show",
      "--format=",
      "--name-status",
      "--find-renames",
      "--find-copies",
      hash,
    ], true)

    if (result.code !== 0) {
      const details = result.stderr || result.stdout
      throw new Error(details || "Failed to load commit files.")
    }

    if (!result.stdout.trim()) return []

    return result.stdout
      .split("\n")
      .map((line) => parseCommitFileLine(line))
      .filter((entry): entry is CommitFileChange => entry !== null)
  }

  async diffForCommitFile(commitHash: string, path: string): Promise<string> {
    const hash = commitHash.trim()
    if (!hash) throw new Error("Commit hash is required.")

    const normalizedPath = path.trim()
    if (!normalizedPath) throw new Error("Commit file path is required.")

    const whitespaceArgs = this.options.hideWhitespaceChanges ? ["-w"] : []
    const result = await this.runGit([
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
    ], true)

    if (result.code !== 0) {
      const details = result.stderr || result.stdout
      throw new Error(details || "Failed to load commit file diff.")
    }

    return result.stdout
  }

  async checkout(branch: string): Promise<void> {
    if (!branch.trim()) {
      throw new Error("Branch name is required.")
    }
    await this.runGit(["checkout", branch])
  }

  async checkoutLeavingChanges(branch: string): Promise<void> {
    await this.runWithStashedChanges(() => this.checkout(branch))
  }

  async checkoutCommit(commitHash: string): Promise<void> {
    const hash = commitHash.trim()
    if (!hash) throw new Error("Commit hash is required.")
    await this.runGit(["checkout", hash])
  }

  async createAndCheckoutBranch(branchName: string): Promise<void> {
    const name = normalizeBranchName(branchName)
    if (!name) {
      throw new Error("Branch name is required.")
    }

    const validation = await this.runGit(["check-ref-format", "--branch", name], true)
    if (validation.code !== 0) {
      throw new Error(`Invalid branch name: ${name}`)
    }

    await this.runGit(["checkout", "-b", name])
  }

  async createAndCheckoutBranchLeavingChanges(branchName: string): Promise<void> {
    await this.runWithStashedChanges(() => this.createAndCheckoutBranch(branchName))
  }

  async revertCommit(commitHash: string): Promise<void> {
    const hash = commitHash.trim()
    if (!hash) throw new Error("Commit hash is required.")
    await this.runGit(["revert", "--no-edit", hash])
  }

  async commit(summary: string, description: string, excludedPaths: string[] = [], includedPaths: string[] = []): Promise<void> {
    const title = summary.trim()
    if (!title) {
      throw new Error("Commit summary is required.")
    }

    const selectedPaths = includedPaths.map((path) => path.trim()).filter(Boolean)
    if (selectedPaths.length === 0) {
      throw new Error("No files selected for commit.")
    }

    if (this.options.autoStageOnCommit) {
      await this.runGit(["add", "-A"])
    } else {
      await this.runGit(["add", "-A", "--", ...selectedPaths])
    }

    const excluded = excludedPaths.map((path) => path.trim()).filter(Boolean)
    if (excluded.length > 0) {
      const stagedExcluded = await this.runGit(["diff", "--name-only", "--cached", "--", ...excluded], true)
      const stagedExcludedPaths = stagedExcluded.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      if (stagedExcludedPaths.length > 0) {
        await this.runGit(["reset", "--", ...stagedExcludedPaths])
      }
    }

    const hasStagedChanges = await this.runGit(["diff", "--cached", "--quiet"], true)
    if (hasStagedChanges.code === 0) {
      throw new Error("No files selected for commit.")
    }

    const args = ["commit", "-m", title]
    if (description.trim()) {
      args.push("-m", description.trim())
    }
    await this.runGit(args)
  }

  private async runGit(args: string[], allowFailure = false): Promise<GitCommandResult> {
    const result = await runGitRaw(this.root, args)
    if (result.code !== 0 && !allowFailure) {
      const details = result.stderr || result.stdout
      throw new Error(details || `git ${args.join(" ")} failed with code ${result.code}.`)
    }
    return result
  }

  private async runWithStashedChanges(task: () => Promise<void>): Promise<void> {
    const marker = `stage-tui-leave-${Date.now()}`
    const stashResult = await this.runGit(["stash", "push", "-u", "-m", marker], true)
    if (stashResult.code !== 0) {
      const details = stashResult.stderr || stashResult.stdout
      throw new Error(details || "Failed to stash working changes.")
    }

    const output = `${stashResult.stdout}\n${stashResult.stderr}`.toLowerCase()
    const stashed = output.includes("saved working directory") || output.includes("saved index state")
    if (!stashed) {
      await task()
      return
    }

    try {
      await task()
    } catch (error) {
      const restoreResult = await this.runGit(["stash", "pop"], true)
      if (restoreResult.code !== 0) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`${message} Also failed to restore stashed changes automatically.`)
      }
      throw error
    }
  }
}

type BranchRef = {
  name: string
  createdAtUnix: number
}

function parseBranchRefLine(line: string): BranchRef | null {
  const parts = line.split("\t")
  const name = (parts[0] ?? "").trim()
  if (!name) return null

  const parsedTimestamp = Number.parseInt((parts[1] ?? "").trim(), 10)
  return {
    name,
    createdAtUnix: Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0,
  }
}

function sortBranchNames(branchRefs: BranchRef[]): BranchRef[] {
  if (branchRefs.length <= 1) return branchRefs

  const main = branchRefs.find((entry) => entry.name === "main")
  const master = branchRefs.find((entry) => entry.name === "master")
  const pinned = [main, master].filter((entry): entry is BranchRef => entry !== undefined)
  const pinnedNames = new Set(pinned.map((entry) => entry.name))

  const rest = branchRefs
    .filter((entry) => !pinnedNames.has(entry.name))
    .sort((a, b) => {
      if (a.createdAtUnix === b.createdAtUnix) {
        return a.name.localeCompare(b.name)
      }
      return b.createdAtUnix - a.createdAtUnix
    })

  return [...pinned, ...rest]
}

function parseCommitFileLine(line: string): CommitFileChange | null {
  const parts = line.split("\t").map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const rawStatus = parts[0] ?? ""
  const status = rawStatus.charAt(0).toUpperCase()
  if (!status) return null

  if (status === "R" || status === "C") {
    const fromPath = parts[1] ?? ""
    const toPath = parts[2] ?? fromPath
    if (!toPath) return null
    return {
      path: toPath,
      status,
      displayPath: fromPath && fromPath !== toPath ? `${fromPath} -> ${toPath}` : toPath,
    }
  }

  const path = parts[1] ?? ""
  if (!path) return null
  return {
    path,
    status,
    displayPath: path,
  }
}
