import { homedir } from "node:os"
import { join, resolve } from "node:path"

import { ensureUserConfigFile } from "./config-file"
import { parseStageConfigToml } from "./config-parser"

export type StageConfig = {
  ui: {
    diffView: "unified" | "split"
    theme: "auto" | "dark" | "light"
    hideWhitespaceChanges: boolean
    showShortcutsHint: boolean
  }
  history: {
    limit: number
  }
  git: {
    autoStageOnCommit: boolean
  }
  ai: {
    enabled: boolean
    provider: "cerebras"
    apiKey: string
    model: string
    reasoningEffort: "low" | "medium" | "high"
    maxInputTokens: number
    maxFiles: number
    maxTokensPerFile: number
  }
}

export type ResolvedStageConfig = {
  config: StageConfig
  source: string
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  ui: {
    diffView: "unified",
    theme: "auto",
    hideWhitespaceChanges: true,
    showShortcutsHint: true,
  },
  history: {
    limit: 200,
  },
  git: {
    autoStageOnCommit: true,
  },
  ai: {
    enabled: false,
    provider: "cerebras",
    apiKey: "",
    model: "gpt-oss-120b",
    reasoningEffort: "low",
    maxInputTokens: 24000,
    maxFiles: 32,
    maxTokensPerFile: 4000,
  },
}

export async function loadStageConfig(cwd: string): Promise<ResolvedStageConfig> {
  const envPath = process.env.STAGE_CONFIG?.trim()
  if (envPath) {
    const explicitPath = resolve(cwd, envPath)
    const file = Bun.file(explicitPath)
    if (!(await file.exists())) {
      throw new Error(`Config file from STAGE_CONFIG was not found: ${explicitPath}`)
    }
    const raw = await file.text()
    return {
      config: parseStageConfigToml(raw, explicitPath, DEFAULT_STAGE_CONFIG),
      source: explicitPath,
    }
  }

  const localPath = resolve(cwd, ".stage.toml")
  const localFile = Bun.file(localPath)
  if (await localFile.exists()) {
    const raw = await localFile.text()
    return {
      config: parseStageConfigToml(raw, localPath, DEFAULT_STAGE_CONFIG),
      source: localPath,
    }
  }

  const userPath = getUserConfigPath()
  const userFile = Bun.file(userPath)
  if (await userFile.exists()) {
    const raw = await userFile.text()
    return {
      config: parseStageConfigToml(raw, userPath, DEFAULT_STAGE_CONFIG),
      source: userPath,
    }
  }

  await ensureUserConfigFile(userPath, DEFAULT_STAGE_CONFIG)
  const createdRaw = await Bun.file(userPath).text()
  return {
    config: parseStageConfigToml(createdRaw, userPath, DEFAULT_STAGE_CONFIG),
    source: userPath,
  }
}

export function getUserConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim()
  const configRoot = xdg ? xdg : join(homedir(), ".config")
  return join(configRoot, "stage", "config.toml")
}
