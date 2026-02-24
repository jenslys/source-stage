import { generateText, NoObjectGeneratedError, Output } from "ai"

import {
  COMMIT_OUTPUT_FLEXIBLE_SCHEMA,
  COMMIT_SUBJECT_MAX_LENGTH,
  COMMIT_TYPES,
  CONVENTIONAL_COMMIT_REGEX,
  type CommitType,
  SCOPE_REGEX,
} from "./policy"
import { buildSystemPrompt, buildUserPrompt, resolveMaxOutputTokens } from "./prompts"

export type TextGenerationModel = Parameters<typeof generateText>[0]["model"]

type CommitDraft = {
  type: CommitType
  scope?: string
  description: string
}

export async function generateCommitDraft(
  model: TextGenerationModel,
  context: string,
  reasoningEffort: "low" | "medium" | "high",
  retry: boolean,
): Promise<string | null> {
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

    return finalizeCommitSummary(normalizeCommitDraft(output))
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) {
      throw error
    }

    const fallbackText = typeof error.text === "string" ? error.text : ""
    return finalizeCommitSummary(normalizeCommitDraft(extractJsonObject(fallbackText)))
  }
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
  if (!normalized || !SCOPE_REGEX.test(normalized)) {
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
  const maxDescriptionLength = Math.max(COMMIT_SUBJECT_MAX_LENGTH - prefixWithColon.length, 1)
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
  const wordSafe =
    lastSpace >= Math.floor(maxLength * 0.6) ? clipped.slice(0, lastSpace).trim() : clipped
  return trimTrailingConnector(wordSafe.replace(/[.]+$/, "").trim())
}

function trimTrailingConnector(text: string): string {
  const connectors = new Set([
    "and",
    "or",
    "to",
    "on",
    "with",
    "for",
    "of",
    "the",
    "a",
    "an",
    "via",
    "when",
    "by",
    "if",
    "while",
  ])
  const words = text.split(" ").filter(Boolean)
  while (words.length > 1 && connectors.has(words[words.length - 1] ?? "")) {
    words.pop()
  }
  return words.join(" ")
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
