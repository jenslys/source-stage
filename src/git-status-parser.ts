import type { ChangedFile } from "./git"

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

type BranchStatus = {
  branch: string
  upstream: string | null
  ahead: number
  behind: number
}

export function parseStatusOutput(statusOutput: string): {
  branch: BranchStatus
  files: ChangedFile[]
} {
  const tokens = statusOutput.split("\u0000").filter((token) => token.length > 0)
  const branchToken = tokens[0]?.startsWith("##") ? (tokens.shift() ?? "") : ""

  return {
    branch: parseBranchLine(branchToken),
    files: parseChangedFiles(tokens),
  }
}

export function parseBranchLine(line: string): BranchStatus {
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

function parseChangedFiles(tokens: string[]): ChangedFile[] {
  const files: ChangedFile[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ""
    if (token.length < 3) continue

    const indexStatus = token[0] ?? " "
    const worktreeStatus = token[1] ?? " "
    const pathToken = token.slice(3)

    let path = pathToken
    if (
      (indexStatus === "R" ||
        indexStatus === "C" ||
        worktreeStatus === "R" ||
        worktreeStatus === "C") &&
      tokens[index + 1]
    ) {
      path = tokens[index + 1] ?? pathToken
      index += 1
    }

    if (!path) continue

    const untracked = indexStatus === "?" && worktreeStatus === "?"
    const staged = !untracked && indexStatus !== " "
    const unstaged = !untracked && worktreeStatus !== " "

    files.push({
      path,
      indexStatus,
      worktreeStatus,
      staged,
      unstaged,
      untracked,
      statusLabel: buildStatusLabel(indexStatus, worktreeStatus),
    })
  }

  return files
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
