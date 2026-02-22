import { createCerebras } from "@ai-sdk/cerebras"
import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai"

import type { StageConfig } from "./config"
import type { ChangedFile, GitClient } from "./git"

const COMMIT_TYPES = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"] as const
type CommitType = (typeof COMMIT_TYPES)[number]
const SCOPE_REGEX = /^[a-z0-9._/-]+$/
const MAX_RECENT_COMMIT_SUBJECTS = 6

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: [^A-Z].+$/

const COMMIT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "description"],
  properties: {
    type: {
      type: "string",
      enum: COMMIT_TYPES,
      description: "Conventional commit type based on behavior impact.",
    },
    scope: {
      type: "string",
      description: "Optional subsystem noun such as ui, git, config, keyboard.",
    },
    description: {
      type: "string",
      description: "Imperative, concise summary of what changed.",
    },
  },
} as const

const COMMIT_OUTPUT_FLEXIBLE_SCHEMA = jsonSchema<{
  type: CommitType
  scope?: string
  description: string
}>(COMMIT_OUTPUT_SCHEMA)

type GenerateAiCommitSummaryParams = {
  git: GitClient
  files: ChangedFile[]
  selectedPaths: string[]
  aiConfig: StageConfig["ai"]
}

type TextGenerationModel = Parameters<typeof generateText>[0]["model"]

export async function generateAiCommitSummary({
  git,
  files,
  selectedPaths,
  aiConfig,
}: GenerateAiCommitSummaryParams): Promise<string> {
  if (!aiConfig.enabled) {
    throw new Error("AI commit generation is disabled in config.")
  }
  if (aiConfig.provider !== "cerebras") {
    throw new Error(`Unsupported AI provider: ${aiConfig.provider}`)
  }
  if (!aiConfig.apiKey.trim()) {
    throw new Error("AI commit generation requires ai.api_key.")
  }

  const selected = selectedPaths.map((path) => path.trim()).filter(Boolean)
  if (selected.length === 0) {
    throw new Error("No files selected for AI commit.")
  }

  const fileByPath = new Map(files.map((file) => [file.path, file]))
  const context = await buildCommitContext({
    git,
    fileByPath,
    selectedPaths: selected,
    maxFiles: aiConfig.maxFiles,
    maxCharsPerFile: aiConfig.maxCharsPerFile,
  })

  const cerebras = createCerebras({
    apiKey: aiConfig.apiKey,
  })
  const model = cerebras(aiConfig.model)
  const firstAttempt = await generateCommitDraft(model, context, aiConfig.reasoningEffort, false)
  const firstValid = finalizeCommitSummary(firstAttempt)
  if (firstValid) {
    return firstValid
  }

  const secondAttempt = await generateCommitDraft(model, context, aiConfig.reasoningEffort, true)
  const secondValid = finalizeCommitSummary(secondAttempt)
  if (secondValid) {
    return secondValid
  }

  throw new Error(
    "AI did not return a usable conventional commit message. Try again or adjust ai.reasoning_effort / ai.max_chars_per_file.",
  )
}

type BuildCommitContextParams = {
  git: GitClient
  fileByPath: Map<string, ChangedFile>
  selectedPaths: string[]
  maxFiles: number
  maxCharsPerFile: number
}

async function buildCommitContext({
  git,
  fileByPath,
  selectedPaths,
  maxFiles,
  maxCharsPerFile,
}: BuildCommitContextParams): Promise<string> {
  const limitedPaths = selectedPaths.slice(0, maxFiles)
  const signals: ContextSignals = {
    touchedFiles: limitedPaths.length,
    newFiles: 0,
    modifiedFiles: 0,
    deletedFiles: 0,
    renamedFiles: 0,
    addedLines: 0,
    removedLines: 0,
    docsFiles: 0,
    testFiles: 0,
    configFiles: 0,
  }

  const fileSummaries = limitedPaths.map((path) => {
    const file = fileByPath.get(path)
    const status = file ? `${file.indexStatus}${file.worktreeStatus}`.trim() || "??" : "??"
    updateStatusSignals(signals, file)
    updatePathCategorySignals(signals, path)
    return { path, status }
  })

  const snippets = await Promise.all(limitedPaths.map(async (path) => {
    const diff = await git.diffForFile(path)
    const diffStats = analyzeDiff(diff)
    const behaviorCues = collectBehaviorCues(diff)
    const condensed = condenseDiff(diff, maxCharsPerFile)
    return {
      path,
      addedLines: diffStats.addedLines,
      removedLines: diffStats.removedLines,
      behaviorCues,
      condensed,
    }
  }))

  const fileLines = fileSummaries.map((entry) => {
    const snippet = snippets.find((candidate) => candidate.path === entry.path)
    const additions = snippet?.addedLines ?? 0
    const deletions = snippet?.removedLines ?? 0
    signals.addedLines += additions
    signals.removedLines += deletions
    return `- ${entry.status} ${entry.path} (+${additions} -${deletions})`
  })

  const diffHighlights = snippets
    .filter((snippet) => snippet.condensed)
    .map((snippet) => `FILE: ${snippet.path}\n${snippet.condensed}`)

  const behaviorCues = aggregateBehaviorCues(snippets.map((snippet) => snippet.behaviorCues))
  const recentCommitSubjects = await readRecentCommitSubjects(git)
  const existingSurfaceOnly = signals.newFiles === 0 && signals.renamedFiles === 0
  const likelyNewSurface = signals.newFiles > 0 || signals.renamedFiles > 0

  const recentCommitsSection = recentCommitSubjects.length > 0
    ? [
        "",
        "Recent commit subjects (style reference only):",
        ...recentCommitSubjects.map((subject) => `- ${subject}`),
      ]
    : []

  const diffSection = diffHighlights.length > 0
    ? diffHighlights.join("\n\n")
    : "- no diff snippets were captured"

  const selectedPathsSection = selectedPaths.length > limitedPaths.length
    ? `- additional_selected_files_not_shown: ${selectedPaths.length - limitedPaths.length}`
    : "- additional_selected_files_not_shown: 0"

  const lines: string[] = [
    "Context signals:",
    `- touched_files: ${signals.touchedFiles}`,
    `- existing_surface_only: ${existingSurfaceOnly ? "yes" : "no"}`,
    `- likely_new_surface: ${likelyNewSurface ? "yes" : "no"}`,
    `- status_counts: new=${signals.newFiles} modified=${signals.modifiedFiles} deleted=${signals.deletedFiles} renamed=${signals.renamedFiles}`,
    `- diff_line_counts: additions=${signals.addedLines} deletions=${signals.removedLines}`,
    `- file_categories: docs=${signals.docsFiles} tests=${signals.testFiles} config=${signals.configFiles}`,
    selectedPathsSection,
    "- classify by behavior impact first; line counts and file counts are supporting signals",
    "",
    "Behavior cues:",
    `- added_conditions: ${formatCueList(behaviorCues.addedConditions)}`,
    `- removed_conditions: ${formatCueList(behaviorCues.removedConditions)}`,
    `- added_guards: ${formatCueList(behaviorCues.addedGuards)}`,
    `- removed_guards: ${formatCueList(behaviorCues.removedGuards)}`,
    "",
    "Changed files:",
    fileLines.join("\n"),
    ...recentCommitsSection,
    "",
    "Diff highlights:",
    diffSection,
  ]

  return lines.join("\n")
}

async function readRecentCommitSubjects(git: GitClient): Promise<string[]> {
  try {
    const entries = await git.listCommits(MAX_RECENT_COMMIT_SUBJECTS)
    return entries
      .map((entry) => entry.subject.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_COMMIT_SUBJECTS)
  } catch {
    return []
  }
}

function condenseDiff(diff: string, maxChars: number): string {
  const lines = diff.split("\n")
  const relevant: string[] = []
  let changedLines = 0
  let hunkCount = 0
  const MAX_CHANGED_LINES = 120
  const MAX_HUNKS = 12

  for (const line of lines) {
    if (line.startsWith("# ")) {
      relevant.push(line)
      continue
    }
    if (line.startsWith("@@")) {
      hunkCount += 1
      if (hunkCount <= MAX_HUNKS) {
        relevant.push(line)
      }
      continue
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue
    }
    if (line.startsWith("+") || line.startsWith("-")) {
      changedLines += 1
      if (changedLines <= MAX_CHANGED_LINES) {
        relevant.push(line)
      }
    }
  }

  const body = (relevant.length > 0 ? relevant.join("\n") : diff.trim()).trim()
  if (!body) {
    return ""
  }
  if (body.length <= maxChars) {
    return body
  }
  return `${body.slice(0, Math.max(maxChars - 16, 1)).trimEnd()}\n...[truncated]`
}

async function generateCommitDraft(
  model: TextGenerationModel,
  context: string,
  reasoningEffort: "low" | "medium" | "high",
  retry: boolean,
): Promise<CommitDraft | null> {
  const maxOutputTokens = resolveMaxOutputTokens(reasoningEffort)
  try {
    const { output } = await generateText({
      model,
      temperature: 0,
      maxOutputTokens,
      providerOptions: {
        cerebras: {
          reasoningEffort,
          strictJsonSchema: true,
        },
      },
      output: Output.object({
        name: "conventional_commit_subject",
        description: "Conventional commit fields for a concise git subject line.",
        schema: COMMIT_OUTPUT_FLEXIBLE_SCHEMA,
      }),
      system: buildSystemPrompt(retry),
      prompt: buildUserPrompt(context, retry),
    })

    return normalizeCommitDraft(output)
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const fallbackText = typeof error.text === "string" ? error.text : ""
      return normalizeCommitDraft(extractJsonObject(fallbackText))
    }
    throw error
  }
}

function buildSystemPrompt(retry: boolean): string {
  return [
    "You generate conventional commit subjects from git diff context.",
    "Prioritize semantic correctness over wording novelty.",
    "Commit type rubric:",
    "- fix: behavior correction, bug handling, regression prevention, compatibility adjustment.",
    "- feat: net-new user-facing capability or clearly new surface (new command/screen/endpoint/setting).",
    "- refactor: structural changes with no behavior change.",
    "- style: formatting-only edits.",
    "- docs/test/build/ci/chore/perf/revert only when clearly dominant.",
    "- if uncertain between feat and fix, choose fix.",
    "- do not infer feat only from additions, support wording, or larger diff size.",
    "- if changes are in existing files/flows and no new surface is explicit, avoid feat.",
    "- adding compatibility or alternate paths for an existing workflow is usually fix.",
    "- feat requires introducing a meaningfully new workflow/surface to users.",
    "- when conditions/guards are added to prevent unsafe or accidental behavior, this strongly indicates fix.",
    "Style rules:",
    "- scope is optional and must be a lowercase noun token.",
    "- description is imperative, specific, concise, and starts lowercase.",
    "- description must read naturally after '<type>(<scope>):'.",
    "- for fix, phrase the user-visible failure prevented/resolved (often with 'when' or 'on').",
    "- for fix, prefer describing the undesired side effect being prevented.",
    "- for fix, prefer prevent/avoid/handle over enable/add.",
    "- prefer concrete verbs: fix/prevent/handle/enable/avoid/normalize/simplify/refine.",
    "- prefer user-visible behavior over internal API detail names.",
    "- avoid wording that names low-level implementation calls unless unavoidable.",
    "- avoid vague lead verbs like support, update, improve, change.",
    "- avoid 'enable' for fix unless the phrase also states what broken behavior is corrected.",
    "- avoid generic phrases like 'update code' or 'improve things'.",
    retry
      ? "Retry mode: if previous output was invalid, simplify wording while keeping meaning."
      : "Return the best single conventional commit subject metadata for this change set.",
  ].join("\n")
}

function buildUserPrompt(context: string, retry: boolean): string {
  const retryLine = retry
    ? "Retry constraints: keep description short and concrete; prefer simpler scope or omit scope."
    : "Use the context below."
  return [
    retryLine,
    "Output must satisfy schema and conventional commit semantics.",
    "",
    context,
  ].join("\n")
}

type CommitDraft = {
  type: CommitType
  scope?: string
  description: string
}

function normalizeCommitDraft(value: unknown): CommitDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const type = typeof candidate.type === "string" ? candidate.type.trim().toLowerCase() : ""
  if (!isCommitType(type)) {
    return null
  }

  const descriptionRaw = typeof candidate.description === "string" ? candidate.description : ""
  const description = sanitizeDescription(descriptionRaw)
  if (!description) {
    return null
  }

  const scopeRaw = typeof candidate.scope === "string" ? candidate.scope : undefined
  const scope = sanitizeScope(scopeRaw)

  return {
    type,
    scope,
    description,
  }
}

function isCommitType(value: string): value is CommitType {
  return COMMIT_TYPES.includes(value as CommitType)
}

function sanitizeScope(scope: string | undefined): string | undefined {
  if (!scope) {
    return undefined
  }
  const normalized = scope.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (!SCOPE_REGEX.test(normalized)) {
    return undefined
  }
  return normalized
}

function sanitizeDescription(description: string): string {
  const normalized = description
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.]+$/, "")
    .trim()

  if (!normalized) {
    return ""
  }

  const first = normalized[0]
  const loweredFirst = first ? first.toLowerCase() : ""
  return `${loweredFirst}${normalized.slice(1)}`
}

function finalizeCommitSummary(draft: CommitDraft | null): string | null {
  if (!draft) {
    return null
  }

  const prefix = draft.scope ? `${draft.type}(${draft.scope})` : draft.type
  const prefixWithColon = `${prefix}: `
  const maxDescriptionLength = Math.max(72 - prefixWithColon.length, 1)
  const compactDescription = compactDescriptionLength(draft.description, maxDescriptionLength)
  const candidate = `${prefixWithColon}${compactDescription}`
  if (!CONVENTIONAL_COMMIT_REGEX.test(candidate)) {
    return null
  }
  return candidate
}

function compactDescriptionLength(description: string, maxLength: number): string {
  if (description.length <= maxLength) {
    return description
  }

  const clipped = description.slice(0, maxLength).trim()
  const lastSpace = clipped.lastIndexOf(" ")
  const wordSafe = lastSpace >= Math.floor(maxLength * 0.6) ? clipped.slice(0, lastSpace).trim() : clipped
  return trimTrailingConnector(wordSafe.replace(/[.]+$/, "").trim())
}

function trimTrailingConnector(text: string): string {
  const connectors = new Set(["and", "or", "to", "on", "with", "for", "of", "the", "a", "an", "via"])
  const words = text.split(" ").filter(Boolean)
  while (words.length > 1 && connectors.has(words[words.length - 1] ?? "")) {
    words.pop()
  }
  return words.join(" ")
}

type ContextSignals = {
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

type BehaviorCues = {
  addedConditions: string[]
  removedConditions: string[]
  addedGuards: string[]
  removedGuards: string[]
}

function updateStatusSignals(signals: ContextSignals, file: ChangedFile | undefined): void {
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

function updatePathCategorySignals(signals: ContextSignals, path: string): void {
  const normalized = path.toLowerCase()
  if (isDocsPath(normalized)) signals.docsFiles += 1
  if (isTestPath(normalized)) signals.testFiles += 1
  if (isConfigPath(normalized)) signals.configFiles += 1
}

function isDocsPath(path: string): boolean {
  return path.endsWith(".md") || path.endsWith(".mdx") || path.includes("/docs/") || path.startsWith("docs/")
}

function isTestPath(path: string): boolean {
  return path.includes("/test/") || path.includes("/tests/") || path.includes(".test.") || path.includes(".spec.")
}

function isConfigPath(path: string): boolean {
  return (
    path.endsWith(".json")
    || path.endsWith(".yaml")
    || path.endsWith(".yml")
    || path.endsWith(".toml")
    || path.endsWith(".ini")
    || path.endsWith("lock")
    || path.endsWith(".lock")
  )
}

function analyzeDiff(diff: string): { addedLines: number; removedLines: number } {
  let addedLines = 0
  let removedLines = 0

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++")) continue
    if (line.startsWith("---")) continue
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

function collectBehaviorCues(diff: string): BehaviorCues {
  const addedConditions = new Set<string>()
  const removedConditions = new Set<string>()
  const addedGuards = new Set<string>()
  const removedGuards = new Set<string>()

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++")
      || line.startsWith("---")
      || line.startsWith("@@")
      || line.startsWith("# ")) {
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
  }

  return {
    addedConditions: Array.from(addedConditions),
    removedConditions: Array.from(removedConditions),
    addedGuards: Array.from(addedGuards),
    removedGuards: Array.from(removedGuards),
  }
}

function extractConditionCue(line: string): string | null {
  const inline = line.match(/^if\s*\((.*)\)\s*\{?$/)
  if (inline) {
    return normalizeCue(inline[1] ?? "")
  }

  const ternary = line.match(/^.*\?.*:.*/)
  if (ternary) {
    return normalizeCue("ternary-condition")
  }

  return null
}

function extractGuardCue(line: string): string | null {
  if (line.startsWith("return")) {
    return normalizeCue(line)
  }
  if (line.startsWith("throw")) {
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

function normalizeCue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 72) {
    return compact
  }
  return `${compact.slice(0, 69).trimEnd()}...`
}

function aggregateBehaviorCues(cuesList: BehaviorCues[]): BehaviorCues {
  const addedConditions = new Set<string>()
  const removedConditions = new Set<string>()
  const addedGuards = new Set<string>()
  const removedGuards = new Set<string>()

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
  }

  return {
    addedConditions: Array.from(addedConditions),
    removedConditions: Array.from(removedConditions),
    addedGuards: Array.from(addedGuards),
    removedGuards: Array.from(removedGuards),
  }
}

function formatCueList(values: string[]): string {
  if (values.length === 0) {
    return "none"
  }
  const limit = values.slice(0, 6)
  return limit.join(" | ")
}

function resolveMaxOutputTokens(reasoningEffort: "low" | "medium" | "high"): number {
  if (reasoningEffort === "high") return 4096
  if (reasoningEffort === "medium") return 3072
  return 2048
}

function extractJsonObject(text: string): unknown {
  const raw = text.trim()
  if (!raw) {
    return null
  }

  const direct = tryParseJson(raw)
  if (direct !== null) {
    return direct
  }

  const firstBrace = raw.indexOf("{")
  const lastBrace = raw.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParseJson(raw.slice(firstBrace, lastBrace + 1))
  }

  return null
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
