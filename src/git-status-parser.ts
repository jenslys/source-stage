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

export function parseBranchLine(line: string): {
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

export function parseChangedFiles(lines: string[]): ChangedFile[] {
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
