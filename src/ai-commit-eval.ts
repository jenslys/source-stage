import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { generateAiCommitSummary } from "./ai-commit"
import { loadStageConfig, type StageConfig } from "./config"
import { runGitRaw } from "./git-process"
import { GitClient, type ChangedFile } from "./git"

type CliOptions = {
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

type EvalResult = {
  mode: "working" | "commit"
  commit?: string
  worktreePath?: string
  selectedPaths: string[]
  actualSubject?: string
  generatedSubject: string
  generatedLength: number
}

const HELP_TEXT = `
AI commit eval runner

Usage:
  bun run src/ai-commit-eval.ts [options]
  bun run eval:ai -- [options]

Modes:
  default                     Evaluate current working tree.
  --commit <sha>              Replay commit changes in a temp worktree and evaluate.
                              Can be repeated.

Path selection:
  --paths <a,b,c>             Evaluate only these changed paths.
  --path <path>               Repeatable single-path form.

AI overrides (optional):
  --api-key <key>
  --model <name>
  --reasoning-effort <low|medium|high>
  --max-input-tokens <int>
  --max-files <int>
  --max-tokens-per-file <int>

Output:
  --json                      Emit machine-readable JSON.
  --keep-worktrees            Keep temp worktrees used for commit replay.
  --help                      Show this help.
`.trim()

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if ((process.argv.slice(2).includes("--help")) || (process.argv.slice(2).includes("-h"))) {
    console.log(HELP_TEXT)
    return
  }

  const cwd = process.cwd()
  const resolvedConfig = await loadStageConfig(cwd)
  const aiConfig = resolveAiConfig(resolvedConfig.config.ai, options)
  const gitOptions = {
    historyLimit: resolvedConfig.config.history.limit,
    hideWhitespaceChanges: resolvedConfig.config.ui.hideWhitespaceChanges,
    autoStageOnCommit: resolvedConfig.config.git.autoStageOnCommit,
  } as const

  const results: EvalResult[] = []
  if (options.commits.length > 0) {
    for (const commit of options.commits) {
      const result = await evaluateCommit({
        repoCwd: cwd,
        commit,
        selectedPathsOverride: options.paths,
        keepWorktree: options.keepWorktrees,
        aiConfig,
        gitOptions,
      })
      results.push(result)
    }
  } else {
    const result = await evaluateWorkingTree({
      cwd,
      selectedPathsOverride: options.paths,
      aiConfig,
      gitOptions,
    })
    results.push(result)
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  for (const [index, result] of results.entries()) {
    console.log(`Result ${index + 1}/${results.length}`)
    console.log(`mode: ${result.mode}`)
    if (result.commit) console.log(`commit: ${result.commit}`)
    if (result.actualSubject) console.log(`actual: ${result.actualSubject}`)
    if (result.worktreePath) console.log(`worktree: ${result.worktreePath}`)
    console.log(`files: ${result.selectedPaths.length}`)
    for (const path of result.selectedPaths) {
      console.log(`- ${path}`)
    }
    console.log(`generated: ${result.generatedSubject}`)
    console.log(`length: ${result.generatedLength}`)
    if (index < results.length - 1) {
      console.log("")
    }
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    commits: [],
    paths: [],
    json: false,
    keepWorktrees: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === "--help" || arg === "-h") {
      return options
    }
    if (arg === "--commit") {
      options.commits.push(requireValue(args, ++i, "--commit"))
      continue
    }
    if (arg === "--paths") {
      options.paths.push(...splitPaths(requireValue(args, ++i, "--paths")))
      continue
    }
    if (arg === "--path") {
      options.paths.push(requireValue(args, ++i, "--path").trim())
      continue
    }
    if (arg === "--api-key") {
      options.apiKey = requireValue(args, ++i, "--api-key")
      continue
    }
    if (arg === "--model") {
      options.model = requireValue(args, ++i, "--model")
      continue
    }
    if (arg === "--reasoning-effort") {
      const value = requireValue(args, ++i, "--reasoning-effort")
      if (value !== "low" && value !== "medium" && value !== "high") {
        throw new Error(`Invalid value for --reasoning-effort: ${value}`)
      }
      options.reasoningEffort = value
      continue
    }
    if (arg === "--max-input-tokens") {
      options.maxInputTokens = parsePositiveInteger(requireValue(args, ++i, "--max-input-tokens"), "--max-input-tokens")
      continue
    }
    if (arg === "--max-files") {
      options.maxFiles = parsePositiveInteger(requireValue(args, ++i, "--max-files"), "--max-files")
      continue
    }
    if (arg === "--max-tokens-per-file") {
      options.maxTokensPerFile = parsePositiveInteger(requireValue(args, ++i, "--max-tokens-per-file"), "--max-tokens-per-file")
      continue
    }
    if (arg === "--json") {
      options.json = true
      continue
    }
    if (arg === "--keep-worktrees") {
      options.keepWorktrees = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  options.paths = dedupeNonEmpty(options.paths)
  options.commits = dedupeNonEmpty(options.commits)
  return options
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index]
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function splitPaths(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean)
}

function dedupeNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    output.push(trimmed)
  }
  return output
}

function parsePositiveInteger(raw: string, flag: string): number {
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`)
  }
  return value
}

function resolveAiConfig(base: StageConfig["ai"], options: CliOptions): StageConfig["ai"] {
  const apiKey = (options.apiKey ?? base.apiKey).trim()
  if (!apiKey) {
    throw new Error("AI API key is empty. Set it in config or pass --api-key.")
  }

  return {
    enabled: true,
    provider: "cerebras",
    apiKey,
    model: options.model ?? base.model,
    reasoningEffort: options.reasoningEffort ?? base.reasoningEffort,
    maxInputTokens: options.maxInputTokens ?? base.maxInputTokens,
    maxFiles: options.maxFiles ?? base.maxFiles,
    maxTokensPerFile: options.maxTokensPerFile ?? base.maxTokensPerFile,
  }
}

async function evaluateWorkingTree({
  cwd,
  selectedPathsOverride,
  aiConfig,
  gitOptions,
}: {
  cwd: string
  selectedPathsOverride: string[]
  aiConfig: StageConfig["ai"]
  gitOptions: { historyLimit: number; hideWhitespaceChanges: boolean; autoStageOnCommit: boolean }
}): Promise<EvalResult> {
  const git = await GitClient.create(cwd, gitOptions)
  const snapshot = await git.snapshot()
  const selectedPaths = resolveSelectedPaths(snapshot.files, selectedPathsOverride)
  const summary = await generateAiCommitSummary({
    git,
    files: snapshot.files,
    selectedPaths,
    aiConfig,
  })

  return {
    mode: "working",
    selectedPaths,
    generatedSubject: summary,
    generatedLength: summary.length,
  }
}

async function evaluateCommit({
  repoCwd,
  commit,
  selectedPathsOverride,
  keepWorktree,
  aiConfig,
  gitOptions,
}: {
  repoCwd: string
  commit: string
  selectedPathsOverride: string[]
  keepWorktree: boolean
  aiConfig: StageConfig["ai"]
  gitOptions: { historyLimit: number; hideWhitespaceChanges: boolean; autoStageOnCommit: boolean }
}): Promise<EvalResult> {
  const replay = await createReplayWorktree(repoCwd, commit)
  try {
    const git = await GitClient.create(replay.path, gitOptions)
    const snapshot = await git.snapshot()
    const selectedPaths = resolveSelectedPaths(
      snapshot.files,
      selectedPathsOverride.length > 0 ? selectedPathsOverride : replay.commitPaths,
    )

    const summary = await generateAiCommitSummary({
      git,
      files: snapshot.files,
      selectedPaths,
      aiConfig,
    })

    return {
      mode: "commit",
      commit,
      actualSubject: replay.actualSubject,
      worktreePath: keepWorktree ? replay.path : undefined,
      selectedPaths,
      generatedSubject: summary,
      generatedLength: summary.length,
    }
  } finally {
    if (!keepWorktree) {
      await removeWorktree(repoCwd, replay.path)
    }
  }
}

async function createReplayWorktree(repoCwd: string, commit: string): Promise<{
  path: string
  commitPaths: string[]
  actualSubject: string
}> {
  const parent = await runGitOrThrow(repoCwd, ["rev-parse", `${commit}^`], `resolve parent for ${commit}`)
  const actualSubject = await runGitOrThrow(repoCwd, ["show", "-s", "--format=%s", commit], `read subject for ${commit}`)
  const commitPathsOutput = await runGitOrThrow(
    repoCwd,
    ["show", "--name-only", "--pretty=format:", commit],
    `read files for ${commit}`,
  )
  const commitPaths = dedupeNonEmpty(commitPathsOutput.split("\n"))
  if (commitPaths.length === 0) {
    throw new Error(`Commit ${commit} has no changed paths to evaluate.`)
  }

  const path = join(tmpdir(), `stage-ai-eval-${commit.slice(0, 8)}-${randomUUID()}`)
  await runGitOrThrow(repoCwd, ["worktree", "add", "--detach", path, parent.trim()], `create replay worktree for ${commit}`)

  try {
    await runGitOrThrow(path, ["cherry-pick", "-n", commit], `replay ${commit}`)
  } catch (error) {
    await removeWorktree(repoCwd, path)
    throw error
  }

  return {
    path,
    commitPaths,
    actualSubject: actualSubject.trim(),
  }
}

async function removeWorktree(repoCwd: string, worktreePath: string): Promise<void> {
  const result = await runGitRaw(repoCwd, ["worktree", "remove", "--force", worktreePath])
  if (result.code !== 0) {
    const details = result.stderr || result.stdout
    throw new Error(`Failed to remove worktree ${worktreePath}: ${details || "unknown error"}`)
  }
}

function resolveSelectedPaths(files: ChangedFile[], overridePaths: string[]): string[] {
  const changedPaths = new Set(files.map((file) => file.path))
  const selectedPaths = overridePaths.length > 0
    ? dedupeNonEmpty(overridePaths)
    : files.map((file) => file.path)

  if (selectedPaths.length === 0) {
    throw new Error("No changed files selected for evaluation.")
  }

  const missing = selectedPaths.filter((path) => !changedPaths.has(path))
  if (missing.length > 0) {
    throw new Error(`Selected paths are not changed in this evaluation target: ${missing.join(", ")}`)
  }

  return selectedPaths
}

async function runGitOrThrow(cwd: string, args: string[], label: string): Promise<string> {
  const result = await runGitRaw(cwd, args)
  if (result.code !== 0) {
    const details = result.stderr || result.stdout
    throw new Error(`Failed to ${label}: ${details || `git ${args.join(" ")} exited ${result.code}`}`)
  }
  return result.stdout
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`AI eval failed: ${message}`)
  process.exit(1)
})
