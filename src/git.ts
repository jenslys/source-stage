import { runGitRaw, type GitCommandResult } from "./git-process"
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

export class GitClient {
  private constructor(
    private readonly root: string,
    private readonly cwd: string,
  ) {}

  static async create(cwd: string): Promise<GitClient> {
    const rootResult = await runGitRaw(cwd, ["rev-parse", "--show-toplevel"])
    if (rootResult.code !== 0) {
      throw new Error(rootResult.stderr || "Current directory is not a git repository.")
    }
    const root = rootResult.stdout.trim()
    if (!root) {
      throw new Error("Failed to resolve git repository root.")
    }
    return new GitClient(root, cwd)
  }

  async snapshot(): Promise<RepoSnapshot> {
    const [statusResult, branchesResult] = await Promise.all([
      this.runGit(["status", "--porcelain=v1", "--branch", "--untracked-files=all"]),
      this.runGit(["for-each-ref", "--format=%(refname:short)", "refs/heads"]),
    ])

    const statusLines = statusResult.stdout.split("\n").filter(Boolean)
    const branchInfo = parseBranchLine(statusLines[0] ?? "")
    const files = parseChangedFiles(statusLines.slice(1))
    const branches = branchesResult.stdout
      .split("\n")
      .map((line) => line.trim())
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
    const [unstaged, staged] = await Promise.all([
      this.runGit(["diff", "-w", "--", path], true),
      this.runGit(["diff", "--cached", "-w", "--", path], true),
    ])

    const sections: string[] = []
    if (staged.stdout.trim()) {
      sections.push(`# Staged\n${staged.stdout.trimEnd()}`)
    }
    if (unstaged.stdout.trim()) {
      sections.push(`# Unstaged\n${unstaged.stdout.trimEnd()}`)
    }

    if (sections.length > 0) {
      return sections.join("\n\n")
    }

    const untracked = await this.runGit(["diff", "--no-index", "-w", "--", "/dev/null", path], true)
    if (untracked.stdout.trim()) {
      return `# Untracked\n${untracked.stdout.trimEnd()}`
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

  async checkout(branch: string): Promise<void> {
    if (!branch.trim()) {
      throw new Error("Branch name is required.")
    }
    await this.runGit(["checkout", branch])
  }

  async checkoutLeavingChanges(branch: string): Promise<void> {
    await this.runWithStashedChanges(() => this.checkout(branch))
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

  async commit(summary: string, description: string, excludedPaths: string[] = []): Promise<void> {
    const title = summary.trim()
    if (!title) {
      throw new Error("Commit summary is required.")
    }

    await this.runGit(["add", "-A"])
    if (excludedPaths.length > 0) {
      await this.runGit(["reset", "--", ...excludedPaths], true)
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
    const marker = `github-tui-leave-${Date.now()}`
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

function normalizeBranchName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/\/-/g, "/")
    .replace(/-\//g, "/")
    .replace(/^[-/]+|[-/]+$/g, "")

  return normalized
}
