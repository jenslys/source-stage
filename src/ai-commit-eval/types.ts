import type { StageConfig } from "../config"
import type { CommitContextStats } from "../ai-commit"

export type CliOptions = {
  commits: string[]
  paths: string[]
  json: boolean
  verbose: boolean
  keepWorktrees: boolean
  apiKey?: string
  model?: string
  reasoningEffort?: StageConfig["ai"]["reasoningEffort"]
  maxInputTokens?: number
}

export type EvalResult = {
  mode: "working" | "commit"
  commit?: string
  worktreePath?: string
  selectedPaths: string[]
  actualSubject?: string
  generatedSubject: string
  generatedLength: number
  contextStats?: CommitContextStats
}

export type GitEvalOptions = {
  historyLimit: number
  hideWhitespaceChanges: boolean
  autoStageOnCommit: boolean
}
