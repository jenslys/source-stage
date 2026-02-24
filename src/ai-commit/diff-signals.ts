import type { ChangedFile } from "../git"

export type ContextSignals = {
  touchedFiles: number
  newFiles: number
  modifiedFiles: number
  deletedFiles: number
  renamedFiles: number
  addedLines: number
  removedLines: number
  docsFiles: number
  testFiles: number
  configFiles: number
}

export type BehaviorCues = {
  addedConditions: string[]
  removedConditions: string[]
  addedGuards: string[]
  removedGuards: string[]
  addedCalls: string[]
  removedCalls: string[]
}

export function updateStatusSignals(signals: ContextSignals, file: ChangedFile | undefined): void {
  if (!file) return
  if (file.untracked) {
    signals.newFiles += 1
    return
  }

  const statuses = [file.indexStatus, file.worktreeStatus]
  if (statuses.includes("D")) {
    signals.deletedFiles += 1
    return
  }
  if (statuses.includes("R")) {
    signals.renamedFiles += 1
    return
  }
  if (statuses.includes("A")) {
    signals.newFiles += 1
    return
  }
  signals.modifiedFiles += 1
}

export function updatePathCategorySignals(signals: ContextSignals, path: string): void {
  const normalized = path.toLowerCase()
  if (isDocsPath(normalized)) signals.docsFiles += 1
  if (isTestPath(normalized)) signals.testFiles += 1
  if (isConfigPath(normalized)) signals.configFiles += 1
}

export function analyzeDiff(diff: string): { addedLines: number; removedLines: number } {
  let addedLines = 0
  let removedLines = 0

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue
    if (line.startsWith("+")) {
      addedLines += 1
      continue
    }
    if (line.startsWith("-")) {
      removedLines += 1
    }
  }

  return { addedLines, removedLines }
}

export function collectBehaviorCues(diff: string): BehaviorCues {
  const addedConditions = new Set<string>()
  const removedConditions = new Set<string>()
  const addedGuards = new Set<string>()
  const removedGuards = new Set<string>()
  const addedCalls = new Set<string>()
  const removedCalls = new Set<string>()

  for (const line of diff.split("\n")) {
    if (
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("@@") ||
      line.startsWith("# ")
    ) {
      continue
    }

    const isAdded = line.startsWith("+")
    const isRemoved = line.startsWith("-")
    if (!isAdded && !isRemoved) {
      continue
    }

    const content = line.slice(1).trim()
    if (!content) {
      continue
    }

    const condition = extractConditionCue(content)
    if (condition) {
      if (isAdded) {
        addedConditions.add(condition)
      } else {
        removedConditions.add(condition)
      }
    }

    const guard = extractGuardCue(content)
    if (guard) {
      if (isAdded) {
        addedGuards.add(guard)
      } else {
        removedGuards.add(guard)
      }
    }

    const call = extractCallCue(content)
    if (call) {
      if (isAdded) {
        addedCalls.add(call)
      } else {
        removedCalls.add(call)
      }
    }
  }

  return {
    addedConditions: Array.from(addedConditions),
    removedConditions: Array.from(removedConditions),
    addedGuards: Array.from(addedGuards),
    removedGuards: Array.from(removedGuards),
    addedCalls: Array.from(addedCalls),
    removedCalls: Array.from(removedCalls),
  }
}

export function aggregateBehaviorCues(cuesList: BehaviorCues[]): BehaviorCues {
  const addedConditions = new Set<string>()
  const removedConditions = new Set<string>()
  const addedGuards = new Set<string>()
  const removedGuards = new Set<string>()
  const addedCalls = new Set<string>()
  const removedCalls = new Set<string>()

  for (const cues of cuesList) {
    for (const value of cues.addedConditions) {
      addedConditions.add(value)
    }
    for (const value of cues.removedConditions) {
      removedConditions.add(value)
    }
    for (const value of cues.addedGuards) {
      addedGuards.add(value)
    }
    for (const value of cues.removedGuards) {
      removedGuards.add(value)
    }
    for (const value of cues.addedCalls) {
      addedCalls.add(value)
    }
    for (const value of cues.removedCalls) {
      removedCalls.add(value)
    }
  }

  return {
    addedConditions: Array.from(addedConditions),
    removedConditions: Array.from(removedConditions),
    addedGuards: Array.from(addedGuards),
    removedGuards: Array.from(removedGuards),
    addedCalls: Array.from(addedCalls),
    removedCalls: Array.from(removedCalls),
  }
}

export function formatCueList(values: string[]): string {
  if (values.length === 0) {
    return "none"
  }
  return values.slice(0, 6).join(" | ")
}

function isDocsPath(path: string): boolean {
  return (
    path.endsWith(".md") ||
    path.endsWith(".mdx") ||
    path.includes("/docs/") ||
    path.startsWith("docs/")
  )
}

function isTestPath(path: string): boolean {
  return (
    path.includes("/test/") ||
    path.includes("/tests/") ||
    path.includes(".test.") ||
    path.includes(".spec.")
  )
}

function isConfigPath(path: string): boolean {
  return (
    path.endsWith(".json") ||
    path.endsWith(".yaml") ||
    path.endsWith(".yml") ||
    path.endsWith(".toml") ||
    path.endsWith(".ini") ||
    path.endsWith("lock") ||
    path.endsWith(".lock")
  )
}

function extractConditionCue(line: string): string | null {
  const inline = line.match(/^if\s*\((.*)\)\s*\{?$/)
  if (inline) {
    return normalizeCue(inline[1] ?? "")
  }

  if (/^.*\?.*:.*/.test(line)) {
    return normalizeCue("ternary-condition")
  }

  return null
}

function extractGuardCue(line: string): string | null {
  if (line.startsWith("return") || line.startsWith("throw")) {
    return normalizeCue(line)
  }
  if (line.includes(".preventDefault(")) {
    return "preventDefault()"
  }
  if (line.includes(".stopPropagation(")) {
    return "stopPropagation()"
  }
  return null
}

function extractCallCue(line: string): string | null {
  const match = line.match(/([A-Za-z_$][A-Za-z0-9_$.]*)\(([^()]*)\)/)
  if (!match) {
    return null
  }

  const callee = (match[1] ?? "").trim()
  if (!callee) {
    return null
  }

  const args = (match[2] ?? "").replace(/\s+/g, " ").trim()
  const compactArgs = args.length > 40 ? `${args.slice(0, 37).trimEnd()}...` : args
  return normalizeCue(`${callee}(${compactArgs})`)
}

function normalizeCue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 72) {
    return compact
  }
  return `${compact.slice(0, 69).trimEnd()}...`
}
