import { homedir } from "node:os"
import { join, resolve } from "node:path"

export type StageConfig = {
  ui: {
    diffView: "unified" | "split"
    hideWhitespaceChanges: boolean
    showShortcutsHint: boolean
  }
  history: {
    limit: number
  }
  git: {
    autoStageOnCommit: boolean
  }
}

export type ResolvedStageConfig = {
  config: StageConfig
  source: string
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  ui: {
    diffView: "unified",
    hideWhitespaceChanges: true,
    showShortcutsHint: true,
  },
  history: {
    limit: 200,
  },
  git: {
    autoStageOnCommit: true,
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

  const localPath = resolve(cwd, ".stage-manager.toml")
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

  return {
    config: cloneConfig(DEFAULT_STAGE_CONFIG),
    source: "defaults",
  }
}

export function getUserConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim()
  const configRoot = xdg ? xdg : join(homedir(), ".config")
  return join(configRoot, "stage-manager", "config.toml")
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
  assertNoUnknownKeys(root, ["ui", "history", "git"], `Config root in ${sourcePath}`)

  const config = cloneConfig(DEFAULT_STAGE_CONFIG)

  if (root.ui !== undefined) {
    const ui = asRecord(root.ui, `[ui] in ${sourcePath}`)
    assertNoUnknownKeys(ui, ["diff_view", "hide_whitespace_changes", "show_shortcuts_hint"], `[ui] in ${sourcePath}`)

    if (ui.diff_view !== undefined) {
      if (ui.diff_view !== "unified" && ui.diff_view !== "split") {
        throw new Error(`Invalid value for ui.diff_view in ${sourcePath}. Expected "unified" or "split".`)
      }
      config.ui.diffView = ui.diff_view
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

  return config
}

function cloneConfig(config: StageConfig): StageConfig {
  return {
    ui: {
      diffView: config.ui.diffView,
      hideWhitespaceChanges: config.ui.hideWhitespaceChanges,
      showShortcutsHint: config.ui.showShortcutsHint,
    },
    history: {
      limit: config.history.limit,
    },
    git: {
      autoStageOnCommit: config.git.autoStageOnCommit,
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
