import { homedir } from "node:os"
import { join, resolve } from "node:path"

import { ensureUserConfigFile } from "./config-file"

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
    maxFiles: number
    maxCharsPerFile: number
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
    maxFiles: 32,
    maxCharsPerFile: 4000,
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
      config: parseStageConfigToml(raw, explicitPath),
      source: explicitPath,
    }
  }

  const localPath = resolve(cwd, ".stage.toml")
  const localFile = Bun.file(localPath)
  if (await localFile.exists()) {
    const raw = await localFile.text()
    return {
      config: parseStageConfigToml(raw, localPath),
      source: localPath,
    }
  }

  const userPath = getUserConfigPath()
  const userFile = Bun.file(userPath)
  if (await userFile.exists()) {
    const raw = await userFile.text()
    return {
      config: parseStageConfigToml(raw, userPath),
      source: userPath,
    }
  }

  await ensureUserConfigFile(userPath, DEFAULT_STAGE_CONFIG)
  const createdRaw = await Bun.file(userPath).text()
  return {
    config: parseStageConfigToml(createdRaw, userPath),
    source: userPath,
  }
}

export function getUserConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim()
  const configRoot = xdg ? xdg : join(homedir(), ".config")
  return join(configRoot, "stage", "config.toml")
}

function parseStageConfigToml(raw: string, sourcePath: string): StageConfig {
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid TOML in ${sourcePath}: ${message}`)
  }

  const root = asRecord(parsed, `Config root in ${sourcePath}`)
  assertNoUnknownKeys(root, ["ui", "history", "git", "ai"], `Config root in ${sourcePath}`)

  const config = cloneConfig(DEFAULT_STAGE_CONFIG)

  if (root.ui !== undefined) {
    const ui = asRecord(root.ui, `[ui] in ${sourcePath}`)
    assertNoUnknownKeys(ui, ["diff_view", "theme", "hide_whitespace_changes", "show_shortcuts_hint"], `[ui] in ${sourcePath}`)

    if (ui.diff_view !== undefined) {
      if (ui.diff_view !== "unified" && ui.diff_view !== "split") {
        throw new Error(`Invalid value for ui.diff_view in ${sourcePath}. Expected "unified" or "split".`)
      }
      config.ui.diffView = ui.diff_view
    }

    if (ui.theme !== undefined) {
      if (ui.theme !== "auto" && ui.theme !== "dark" && ui.theme !== "light") {
        throw new Error(`Invalid value for ui.theme in ${sourcePath}. Expected "auto", "dark", or "light".`)
      }
      config.ui.theme = ui.theme
    }

    if (ui.hide_whitespace_changes !== undefined) {
      config.ui.hideWhitespaceChanges = asBoolean(ui.hide_whitespace_changes, `ui.hide_whitespace_changes in ${sourcePath}`)
    }

    if (ui.show_shortcuts_hint !== undefined) {
      config.ui.showShortcutsHint = asBoolean(ui.show_shortcuts_hint, `ui.show_shortcuts_hint in ${sourcePath}`)
    }
  }

  if (root.history !== undefined) {
    const history = asRecord(root.history, `[history] in ${sourcePath}`)
    assertNoUnknownKeys(history, ["limit"], `[history] in ${sourcePath}`)

    if (history.limit !== undefined) {
      const limit = asInteger(history.limit, `history.limit in ${sourcePath}`)
      if (limit <= 0) {
        throw new Error(`history.limit in ${sourcePath} must be greater than 0.`)
      }
      config.history.limit = limit
    }
  }

  if (root.git !== undefined) {
    const git = asRecord(root.git, `[git] in ${sourcePath}`)
    assertNoUnknownKeys(git, ["auto_stage_on_commit"], `[git] in ${sourcePath}`)

    if (git.auto_stage_on_commit !== undefined) {
      config.git.autoStageOnCommit = asBoolean(git.auto_stage_on_commit, `git.auto_stage_on_commit in ${sourcePath}`)
    }
  }

  if (root.ai !== undefined) {
    const ai = asRecord(root.ai, `[ai] in ${sourcePath}`)
    assertNoUnknownKeys(ai, ["enabled", "provider", "api_key", "model", "reasoning_effort", "max_files", "max_chars_per_file"], `[ai] in ${sourcePath}`)

    if (ai.enabled !== undefined) {
      config.ai.enabled = asBoolean(ai.enabled, `ai.enabled in ${sourcePath}`)
    }

    if (ai.provider !== undefined) {
      if (ai.provider !== "cerebras") {
        throw new Error(`Invalid value for ai.provider in ${sourcePath}. Expected "cerebras".`)
      }
      config.ai.provider = ai.provider
    }

    if (ai.api_key !== undefined) {
      if (typeof ai.api_key !== "string") {
        throw new Error(`ai.api_key in ${sourcePath} must be a string.`)
      }
      config.ai.apiKey = ai.api_key.trim()
    }

    if (ai.model !== undefined) {
      if (typeof ai.model !== "string" || !ai.model.trim()) {
        throw new Error(`ai.model in ${sourcePath} must be a non-empty string.`)
      }
      config.ai.model = ai.model.trim()
    }

    if (ai.reasoning_effort !== undefined) {
      if (ai.reasoning_effort !== "low" && ai.reasoning_effort !== "medium" && ai.reasoning_effort !== "high") {
        throw new Error(`Invalid value for ai.reasoning_effort in ${sourcePath}. Expected "low", "medium", or "high".`)
      }
      config.ai.reasoningEffort = ai.reasoning_effort
    }

    if (ai.max_files !== undefined) {
      const maxFiles = asInteger(ai.max_files, `ai.max_files in ${sourcePath}`)
      if (maxFiles <= 0) {
        throw new Error(`ai.max_files in ${sourcePath} must be greater than 0.`)
      }
      config.ai.maxFiles = maxFiles
    }

    if (ai.max_chars_per_file !== undefined) {
      const maxCharsPerFile = asInteger(ai.max_chars_per_file, `ai.max_chars_per_file in ${sourcePath}`)
      if (maxCharsPerFile <= 0) {
        throw new Error(`ai.max_chars_per_file in ${sourcePath} must be greater than 0.`)
      }
      config.ai.maxCharsPerFile = maxCharsPerFile
    }
  }

  if (config.ai.enabled && !config.ai.apiKey) {
    throw new Error(`ai.enabled is true in ${sourcePath}, but ai.api_key is empty.`)
  }

  return config
}

function cloneConfig(config: StageConfig): StageConfig {
  return {
    ui: {
      diffView: config.ui.diffView,
      theme: config.ui.theme,
      hideWhitespaceChanges: config.ui.hideWhitespaceChanges,
      showShortcutsHint: config.ui.showShortcutsHint,
    },
    history: {
      limit: config.history.limit,
    },
    git: {
      autoStageOnCommit: config.git.autoStageOnCommit,
    },
    ai: {
      enabled: config.ai.enabled,
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      reasoningEffort: config.ai.reasoningEffort,
      maxFiles: config.ai.maxFiles,
      maxCharsPerFile: config.ai.maxCharsPerFile,
    },
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a table/object.`)
  }
  return value as Record<string, unknown>
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`)
  }
  return value
}

function asInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`)
  }
  return value
}

function assertNoUnknownKeys(record: Record<string, unknown>, knownKeys: string[], label: string): void {
  const unknown = Object.keys(record).filter((key) => !knownKeys.includes(key))
  if (unknown.length > 0) {
    throw new Error(`${label} has unsupported keys: ${unknown.join(", ")}`)
  }
}
