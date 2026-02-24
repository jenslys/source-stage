import { createCerebras } from "@ai-sdk/cerebras"

import type { StageConfig } from "../config"
import type { ChangedFile, GitClient } from "../git"
import { buildCommitContext } from "./context-builder"
import { generateCommitDraft } from "./draft"
import { resolveTokenizer } from "./tokenizer"

type GenerateAiCommitSummaryParams = {
  git: GitClient
  files: ChangedFile[]
  selectedPaths: string[]
  aiConfig: StageConfig["ai"]
}

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

  const tokenizer = resolveTokenizer(aiConfig.model)
  const fileByPath = new Map(files.map((file) => [file.path, file]))
  const context = await buildCommitContext({
    git,
    fileByPath,
    selectedPaths: selected,
    maxFiles: aiConfig.maxFiles,
    maxInputTokens: aiConfig.maxInputTokens,
    maxTokensPerFile: aiConfig.maxTokensPerFile,
    tokenizer,
  })

  const cerebras = createCerebras({
    apiKey: aiConfig.apiKey,
  })
  const model = cerebras(aiConfig.model)

  const firstAttempt = await generateCommitDraft(model, context, aiConfig.reasoningEffort, false)
  if (firstAttempt) {
    return firstAttempt
  }

  const secondAttempt = await generateCommitDraft(model, context, aiConfig.reasoningEffort, true)
  if (secondAttempt) {
    return secondAttempt
  }

  throw new Error(
    "AI did not return a usable conventional commit message. Try again or adjust ai.reasoning_effort / ai.max_input_tokens / ai.max_tokens_per_file.",
  )
}
