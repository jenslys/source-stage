import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import type { StageConfig } from "./config"

export async function ensureUserConfigFile(
  configPath: string,
  defaults: StageConfig,
): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true })
  try {
    await writeFile(configPath, createDefaultConfigToml(defaults), { flag: "wx" })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EEXIST") throw error
  }
}

function createDefaultConfigToml(defaults: StageConfig): string {
  return [
    "[ui]",
    `diff_view = "${defaults.ui.diffView}"`,
    `theme = "${defaults.ui.theme}"`,
    `hide_whitespace_changes = ${defaults.ui.hideWhitespaceChanges}`,
    `show_shortcuts_hint = ${defaults.ui.showShortcutsHint}`,
    "",
    "[history]",
    `limit = ${defaults.history.limit}`,
    "",
    "[git]",
    `auto_stage_on_commit = ${defaults.git.autoStageOnCommit}`,
    "",
    "[editor]",
    `command = "${defaults.editor.command}"`,
    `args = [${defaults.editor.args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
    "",
    "[ai]",
    `enabled = ${defaults.ai.enabled}`,
    `provider = "${defaults.ai.provider}"`,
    'api_key = ""',
    `model = "${defaults.ai.model}"`,
    `reasoning_effort = "${defaults.ai.reasoningEffort}"`,
    `max_input_tokens = ${defaults.ai.maxInputTokens}`,
    "",
  ].join("\n")
}
