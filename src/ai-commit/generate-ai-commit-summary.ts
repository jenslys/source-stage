import { createCerebras } from "@ai-sdk/cerebras"

import type { StageConfig } from "../config"
import type { ChangedFile, GitClient } from "../git"
import { buildDominantTokenRetryHint, selectBestCommitSubject } from "./candidate-ranking"
import { buildCommitContext, type CommitContextStats } from "./context-builder"
import { generateCommitDraft } from "./draft"
import { resolveTokenizer } from "./tokenizer"

type GenerateAiCommitSummaryParams = {
  git: GitClient
  files: ChangedFile[]
  selectedPaths: string[]
  aiConfig: StageConfig["ai"]
  onContextBuilt?: (stats: CommitContextStats) => void
}

export async function generateAiCommitSummary({
  git,
  files,
  selectedPaths,
  aiConfig,
  onContextBuilt,
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
  const { context, stats } = await buildCommitContext({
    git,
    fileByPath,
    selectedPaths: selected,
    maxInputTokens: aiConfig.maxInputTokens,
    tokenizer,
  })
  onContextBuilt?.(stats)

  const cerebras = createCerebras({
    apiKey: aiConfig.apiKey,
  })
  const model = cerebras(aiConfig.model)

  const candidates: string[] = []
  for (const config of CANDIDATE_ATTEMPTS) {
    const candidate = await generateCommitDraft(
      model,
      context,
      aiConfig.reasoningEffort,
      config.retry,
      config.retryReason,
    )
    if (candidate) {
      candidates.push(candidate)
    }
  }

  const best = selectBestCommitSubject({
    candidates,
    context,
    selectedPaths: selected,
  })
  if (best && !best.hardRejected) {
    return best.subject
  }

  if (best) {
    const retryReason = buildDominantTokenRetryHint({
      context,
      selectedPaths: selected,
      subject: best.subject,
    })
    if (retryReason) {
      const targetedRetry = await generateCommitDraft(
        model,
        context,
        aiConfig.reasoningEffort,
        true,
        retryReason,
      )
      if (targetedRetry) {
        const reselected = selectBestCommitSubject({
          candidates: [...candidates, targetedRetry],
          context,
          selectedPaths: selected,
        })
        if (reselected) {
          return reselected.subject
        }
      }
    }

    return best.subject
  }

  throw new Error(
    "AI did not return a usable conventional commit message. Try again or adjust ai.reasoning_effort / ai.max_input_tokens.",
  )
}

const CANDIDATE_ATTEMPTS: Array<{
  retry: boolean
  retryReason?: string
}> = [
  { retry: false },
  { retry: true, retryReason: "cover dominant changed themes across modules when applicable" },
  { retry: true, retryReason: "avoid narrowing the summary to a single subsystem unless clearly dominant" },
  { retry: true, retryReason: "include major configuration or policy terms when they are prominent" },
]
