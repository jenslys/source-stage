import type { GitCommandResult } from "../git-process"

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

export const DEFAULT_GIT_CLIENT_OPTIONS: GitClientOptions = {
  hideWhitespaceChanges: true,
  historyLimit: 200,
  autoStageOnCommit: true,
}

export type RunGitOptions = {
  expectedCodes?: number[]
  timeoutMs?: number
}

export type RunGit = (args: string[], options?: RunGitOptions) => Promise<GitCommandResult>
