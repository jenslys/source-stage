import type { StageConfig } from "../config"
import type { CliOptions } from "./types"

export function resolveAiConfig(base: StageConfig["ai"], options: CliOptions): StageConfig["ai"] {
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
