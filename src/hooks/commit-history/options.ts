import type { SelectOption } from "@opentui/core"

import type { CommitFileChange, CommitHistoryEntry } from "../../git"

export type HistoryAction = "revert" | "checkout"

export const ACTION_OPTIONS: SelectOption[] = [
  {
    name: "revert commit",
    description: "Create a new commit that reverts this one",
    value: "revert",
  },
  {
    name: "checkout commit",
    description: "Move HEAD to this commit (detached)",
    value: "checkout",
  },
]

export function resolveHistoryAction(index: number): HistoryAction {
  const option = ACTION_OPTIONS[index]
  return option?.value === "checkout" ? "checkout" : "revert"
}

export function toCommitOptions(commits: CommitHistoryEntry[]): SelectOption[] {
  return commits.map((commit) => ({
    name: commit.subject,
    description: `${commit.relativeDate} by ${commit.author}`,
    value: commit.hash,
  }))
}

export function toCommitFileOptions(files: CommitFileChange[]): SelectOption[] {
  return files.map((file) => ({
    name: file.displayPath,
    description: formatCommitFileStatus(file.status),
    value: file.path,
  }))
}

export function buildHistoryDiffCacheKey(commitHash: string, path: string): string {
  return `${commitHash}\u0000${path}`
}

function formatCommitFileStatus(status: string): string {
  if (status === "A") return "added"
  if (status === "C") return "copied"
  if (status === "D") return "deleted"
  if (status === "M") return "modified"
  if (status === "R") return "renamed"
  if (status === "T") return "type changed"
  return status.toLowerCase()
}
