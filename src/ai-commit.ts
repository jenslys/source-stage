import { createCerebras } from "@ai-sdk/cerebras"
import { generateText } from "ai"

import type { StageConfig } from "./config"
import type { ChangedFile, GitClient } from "./git"

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: [^A-Z].+$/

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

  const firstAttempt = await generateCommitCandidate(cerebras(aiConfig.model), buildPrompt(context), aiConfig.reasoningEffort)
  const firstValid = validateCommitSummary(firstAttempt)
  if (firstValid) return firstValid

  const retryPrompt = buildRetryPrompt(context)
  const secondAttempt = await generateCommitCandidate(cerebras(aiConfig.model), retryPrompt, aiConfig.reasoningEffort)
  const secondValid = validateCommitSummary(secondAttempt)
  if (secondValid) return secondValid

  throw new Error(
    "AI did not return a usable conventional commit message. Try again or adjust ai.model / ai.max_chars_per_file.",
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
  const fileLines = limitedPaths.map((path) => {
    const file = fileByPath.get(path)
    const status = file ? `${file.indexStatus}${file.worktreeStatus}`.trim() || "??" : "??"
    return `- ${status} ${path}`
  })

  const snippets: string[] = []
  for (const path of limitedPaths) {
    const diff = await git.diffForFile(path)
    const condensed = condenseDiff(diff, maxCharsPerFile)
    if (!condensed) continue
    snippets.push(`FILE: ${path}\n${condensed}`)
  }

  const sections = [
    "Changed files:",
    fileLines.join("\n"),
    "",
    "Diff highlights:",
    snippets.join("\n\n"),
  ]
  return sections.join("\n")
}

function condenseDiff(diff: string, maxChars: number): string {
  const lines = diff.split("\n")
  const relevant = lines.filter((line) => {
    if (line.startsWith("# ")) return true
    if (line.startsWith("@@")) return true
    if (line.startsWith("+") && !line.startsWith("+++")) return true
    if (line.startsWith("-") && !line.startsWith("---")) return true
    return false
  })

  const body = (relevant.length > 0 ? relevant.join("\n") : diff).trim()
  if (!body) return ""
  if (body.length <= maxChars) return body
  return `${body.slice(0, Math.max(maxChars - 12, 1)).trimEnd()}\n...[truncated]`
}

function buildPrompt(context: string): string {
  return [
    "You write git commit subjects for the provided diff context.",
    "Return exactly one line and nothing else.",
    "Output format must be: type(scope optional): description",
    "Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.",
    "Hard rules:",
    "- description is imperative and lowercase",
    "- keep total length <= 72 characters",
    "- no trailing period",
    "- no markdown, no code fences, no quotes",
    "- no issue numbers, no author names, no explanations",
    "",
    "Good examples:",
    "- feat(auth): add github oauth callback handler",
    "- fix(diff): ignore whitespace-only line changes",
    "- refactor(branch): simplify checkout strategy flow",
    "- chore: rename package to source-stage",
    "",
    "Bad examples:",
    "- Updated files",
    "- Fixed bug in app.",
    "- feat: This commit adds support for ...",
    "- Here is your commit message: fix(ui): align footer status",
    "",
    "Now generate the single best commit subject for this change set.",
    "",
    context,
  ].join("\n")
}

function buildRetryPrompt(context: string): string {
  return [
    "Return exactly one valid conventional commit subject and nothing else.",
    "Format: type(scope optional): description",
    "Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.",
    "Lowercase, imperative, <= 72 chars, no trailing period.",
    "Example: fix(diff): handle empty output from ai response",
    "",
    context,
  ].join("\n")
}

async function generateCommitCandidate(
  model: TextGenerationModel,
  prompt: string,
  reasoningEffort: "low" | "medium" | "high",
): Promise<string | null> {
  const result = await generateText({
    model,
    temperature: 0,
    maxOutputTokens: 256,
    providerOptions: {
      cerebras: {
        reasoningEffort,
      },
    },
    prompt,
  })

  const direct = extractCandidateFromString(result.text)
  if (direct) return direct

  return extractCandidateFromUnknown(result.response?.messages)
}

function validateCommitSummary(candidate: string | null): string | null {
  if (!candidate) return null
  if (!CONVENTIONAL_COMMIT_REGEX.test(candidate)) return null
  if (candidate.length > 72) return null
  return candidate
}

function extractCandidateFromUnknown(value: unknown): string | null {
  const strings: string[] = []
  collectStrings(value, strings, 0)
  for (const text of strings) {
    const candidate = extractCandidateFromString(text)
    if (candidate) return candidate
  }
  return null
}

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth > 6 || out.length > 200) return
  if (typeof value === "string") {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out, depth + 1)
      if (out.length > 200) return
    }
    return
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStrings(nested, out, depth + 1)
      if (out.length > 200) return
    }
  }
}

function extractCandidateFromString(text: string): string | null {
  const lines = text
    .split("\n")
    .map((line) => sanitizeCandidateLine(line))
    .filter(Boolean)

  for (const line of lines) {
    if (CONVENTIONAL_COMMIT_REGEX.test(line) && line.length <= 72) {
      return line
    }
    const embedded = extractEmbeddedConventionalCommit(line)
    if (embedded) return embedded
  }

  return lines[0] ?? null
}

function sanitizeCandidateLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractEmbeddedConventionalCommit(line: string): string | null {
  const normalized = line.toLowerCase()
  for (const type of ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"]) {
    const withScope = new RegExp(`\\b${type}\\([a-z0-9._/-]+\\)!?: [^\\n]+`, "i")
    const scopedMatch = normalized.match(withScope)?.[0]
    if (scopedMatch) {
      const candidate = sanitizeCandidateLine(scopedMatch)
      if (CONVENTIONAL_COMMIT_REGEX.test(candidate) && candidate.length <= 72) return candidate
    }

    const withoutScope = new RegExp(`\\b${type}!?: [^\\n]+`, "i")
    const plainMatch = normalized.match(withoutScope)?.[0]
    if (plainMatch) {
      const candidate = sanitizeCandidateLine(plainMatch)
      if (CONVENTIONAL_COMMIT_REGEX.test(candidate) && candidate.length <= 72) return candidate
    }
  }
  return null
}
