type GitCommandResult = {
  code: number
  stdout: string
  stderr: string
}
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

const STATUS_NAME: Record<string, string> = {
  " ": "clean",
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  U: "unmerged",
  "?": "untracked",
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

  async createAndCheckoutBranch(branchName: string): Promise<void> {
    const name = branchName.trim()
    if (!name) {
      throw new Error("Branch name is required.")
    }
    const validation = await this.runGit(["check-ref-format", "--branch", name], true)
    if (validation.code !== 0) {
      throw new Error(`Invalid branch name: ${name}`)
    }
    await this.runGit(["checkout", "-b", name])
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
}

function parseBranchLine(line: string): {
  branch: string
  upstream: string | null
  ahead: number
  behind: number
} {
  if (!line.startsWith("##")) {
    return { branch: "unknown", upstream: null, ahead: 0, behind: 0 }
  }

  const raw = line.slice(2).trim()
  if (raw.startsWith("No commits yet on ")) {
    return {
      branch: raw.replace("No commits yet on ", "").trim(),
      upstream: null,
      ahead: 0,
      behind: 0,
    }
  }

  if (raw.startsWith("HEAD")) {
    return { branch: "detached", upstream: null, ahead: 0, behind: 0 }
  }

  const [localPart, trackingPart] = raw.split("...")
  const branch = (localPart ?? "unknown").trim()
  let upstream: string | null = null
  let ahead = 0
  let behind = 0

  if (trackingPart) {
    const match = trackingPart.match(/^([^\s]+)(?: \[(.+)\])?$/)
    if (match) {
      upstream = match[1] ?? null
      const tracking = match[2] ?? ""
      for (const token of tracking.split(",").map((item) => item.trim())) {
        if (token.startsWith("ahead ")) {
          ahead = Number(token.slice("ahead ".length)) || 0
        } else if (token.startsWith("behind ")) {
          behind = Number(token.slice("behind ".length)) || 0
        }
      }
    } else {
      upstream = trackingPart.trim() || null
    }
  }

  return { branch, upstream, ahead, behind }
}

function parseChangedFiles(lines: string[]): ChangedFile[] {
  return lines
    .map((line) => {
      const indexStatus = line[0] ?? " "
      const worktreeStatus = line[1] ?? " "
      const pathPart = line.slice(3).trim()
      const path = pathPart.includes(" -> ") ? (pathPart.split(" -> ").pop() ?? "").trim() : pathPart
      if (!path) return null

      const untracked = indexStatus === "?" && worktreeStatus === "?"
      const staged = !untracked && indexStatus !== " "
      const unstaged = !untracked && worktreeStatus !== " "

      return {
        path,
        indexStatus,
        worktreeStatus,
        staged,
        unstaged,
        untracked,
        statusLabel: buildStatusLabel(indexStatus, worktreeStatus),
      } satisfies ChangedFile
    })
    .filter((file): file is ChangedFile => Boolean(file))
}

function buildStatusLabel(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === "?" && worktreeStatus === "?") {
    return "untracked"
  }
  const parts: string[] = []
  if (indexStatus !== " ") {
    parts.push(`staged ${STATUS_NAME[indexStatus] ?? indexStatus}`)
  }
  if (worktreeStatus !== " ") {
    parts.push(`unstaged ${STATUS_NAME[worktreeStatus] ?? worktreeStatus}`)
  }
  return parts.join(", ") || "clean"
}

async function runGitRaw(cwd: string, args: string[]): Promise<GitCommandResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    code,
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
  }
}
