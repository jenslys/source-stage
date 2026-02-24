import type { CommitFileChange } from "./types"

type BranchRef = {
  name: string
  createdAtUnix: number
}

export function parseBranchRefLines(raw: string): string[] {
  return sortBranchNames(
    raw
      .split("\n")
      .map((line) => parseBranchRefLine(line))
      .filter((entry): entry is BranchRef => entry !== null),
  )
    .map((entry) => entry.name)
    .filter(Boolean)
}

export function parseCommitFileChangesNul(raw: string): CommitFileChange[] {
  const tokens = raw.split("\u0000").filter((token) => token.length > 0)
  const files: CommitFileChange[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const rawStatus = (tokens[index] ?? "").trim()
    if (!rawStatus) continue

    const status = rawStatus.charAt(0).toUpperCase()
    if (!status) continue

    if (status === "R" || status === "C") {
      const fromPath = tokens[index + 1] ?? ""
      const toPath = tokens[index + 2] ?? fromPath
      index += 2
      if (!toPath) continue
      files.push({
        path: toPath,
        status,
        displayPath: fromPath && fromPath !== toPath ? `${fromPath} -> ${toPath}` : toPath,
      })
      continue
    }

    const path = tokens[index + 1] ?? ""
    index += 1
    if (!path) continue
    files.push({
      path,
      status,
      displayPath: path,
    })
  }

  return files
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
    .toSorted((a, b) => {
      if (a.createdAtUnix === b.createdAtUnix) {
        return a.name.localeCompare(b.name)
      }
      return b.createdAtUnix - a.createdAtUnix
    })

  return [...pinned, ...rest]
}
