import type { StageConfig } from "./config"

export function parseStageConfigToml(
  raw: string,
  sourcePath: string,
  defaultConfig: StageConfig,
): StageConfig {
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid TOML in ${sourcePath}: ${message}`, { cause: error })
  }

  const root = asRecord(parsed, `Config root in ${sourcePath}`)
  assertNoUnknownKeys(
    root,
    ["ui", "history", "git", "editor", "ai"],
    `Config root in ${sourcePath}`,
  )

  const config = cloneConfig(defaultConfig)

  if (root.ui !== undefined) {
    const ui = asRecord(root.ui, `[ui] in ${sourcePath}`)
    assertNoUnknownKeys(
      ui,
      ["diff_view", "theme", "hide_whitespace_changes", "show_shortcuts_hint"],
      `[ui] in ${sourcePath}`,
    )

    if (ui.diff_view !== undefined) {
      if (ui.diff_view !== "unified" && ui.diff_view !== "split") {
        throw new Error(
          `Invalid value for ui.diff_view in ${sourcePath}. Expected "unified" or "split".`,
        )
      }
      config.ui.diffView = ui.diff_view
    }

    if (ui.theme !== undefined) {
      if (ui.theme !== "auto" && ui.theme !== "dark" && ui.theme !== "light") {
        throw new Error(
          `Invalid value for ui.theme in ${sourcePath}. Expected "auto", "dark", or "light".`,
        )
      }
      config.ui.theme = ui.theme
    }

    if (ui.hide_whitespace_changes !== undefined) {
      config.ui.hideWhitespaceChanges = asBoolean(
        ui.hide_whitespace_changes,
        `ui.hide_whitespace_changes in ${sourcePath}`,
      )
    }

    if (ui.show_shortcuts_hint !== undefined) {
      config.ui.showShortcutsHint = asBoolean(
        ui.show_shortcuts_hint,
        `ui.show_shortcuts_hint in ${sourcePath}`,
      )
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
      config.git.autoStageOnCommit = asBoolean(
        git.auto_stage_on_commit,
        `git.auto_stage_on_commit in ${sourcePath}`,
      )
    }
  }

  if (root.editor !== undefined) {
    const editor = asRecord(root.editor, `[editor] in ${sourcePath}`)
    assertNoUnknownKeys(editor, ["command", "args"], `[editor] in ${sourcePath}`)

    if (editor.command !== undefined) {
      if (typeof editor.command !== "string") {
        throw new Error(`editor.command in ${sourcePath} must be a string.`)
      }
      config.editor.command = editor.command.trim()
    }

    if (editor.args !== undefined) {
      if (!Array.isArray(editor.args)) {
        throw new Error(`editor.args in ${sourcePath} must be an array of strings.`)
      }
      const args = editor.args.map((value, index) => {
        if (typeof value !== "string") {
          throw new Error(`editor.args[${index}] in ${sourcePath} must be a string.`)
        }
        return value
      })
      config.editor.args = args
    }
  }

  if (root.ai !== undefined) {
    const ai = asRecord(root.ai, `[ai] in ${sourcePath}`)
    assertNoUnknownKeys(
      ai,
      [
        "enabled",
        "provider",
        "api_key",
        "model",
        "reasoning_effort",
        "max_input_tokens",
        "max_files",
        "max_tokens_per_file",
      ],
      `[ai] in ${sourcePath}`,
    )

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
      if (
        ai.reasoning_effort !== "low" &&
        ai.reasoning_effort !== "medium" &&
        ai.reasoning_effort !== "high"
      ) {
        throw new Error(
          `Invalid value for ai.reasoning_effort in ${sourcePath}. Expected "low", "medium", or "high".`,
        )
      }
      config.ai.reasoningEffort = ai.reasoning_effort
    }

    if (ai.max_input_tokens !== undefined) {
      const maxInputTokens = asInteger(ai.max_input_tokens, `ai.max_input_tokens in ${sourcePath}`)
      if (maxInputTokens <= 0) {
        throw new Error(`ai.max_input_tokens in ${sourcePath} must be greater than 0.`)
      }
      config.ai.maxInputTokens = maxInputTokens
    }

    if (ai.max_files !== undefined) {
      const maxFiles = asInteger(ai.max_files, `ai.max_files in ${sourcePath}`)
      if (maxFiles <= 0) {
        throw new Error(`ai.max_files in ${sourcePath} must be greater than 0.`)
      }
      config.ai.maxFiles = maxFiles
    }

    if (ai.max_tokens_per_file !== undefined) {
      const maxTokensPerFile = asInteger(
        ai.max_tokens_per_file,
        `ai.max_tokens_per_file in ${sourcePath}`,
      )
      if (maxTokensPerFile <= 0) {
        throw new Error(`ai.max_tokens_per_file in ${sourcePath} must be greater than 0.`)
      }
      config.ai.maxTokensPerFile = maxTokensPerFile
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
    editor: {
      command: config.editor.command,
      args: [...config.editor.args],
    },
    ai: {
      enabled: config.ai.enabled,
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      reasoningEffort: config.ai.reasoningEffort,
      maxInputTokens: config.ai.maxInputTokens,
      maxFiles: config.ai.maxFiles,
      maxTokensPerFile: config.ai.maxTokensPerFile,
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

function assertNoUnknownKeys(
  record: Record<string, unknown>,
  knownKeys: string[],
  label: string,
): void {
  const unknown = Object.keys(record).filter((key) => !knownKeys.includes(key))
  if (unknown.length > 0) {
    throw new Error(`${label} has unsupported keys: ${unknown.join(", ")}`)
  }
}
