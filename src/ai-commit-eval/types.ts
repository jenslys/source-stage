import type { StageConfig } from "../config"

export type CliOptions = {
  commits: string[]
  paths: string[]
  json: boolean
  keepWorktrees: boolean
  apiKey?: string
  model?: string
  reasoningEffort?: StageConfig["ai"]["reasoningEffort"]
  maxInputTokens?: number
  maxFiles?: number
  maxTokensPerFile?: number
}

export type EvalResult = {
  mode: "working" | "commit"
  commit?: string
  worktreePath?: string
  selectedPaths: string[]
  actualSubject?: string
  generatedSubject: string
  generatedLength: number
}

export type GitEvalOptions = {
  historyLimit: number
  hideWhitespaceChanges: boolean
  autoStageOnCommit: boolean
}
