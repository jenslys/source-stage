import type { UiTheme } from "../theme"
import { ViewFrame } from "./view-frame"

type ShortcutsDialogProps = {
  open: boolean
  aiCommitEnabled: boolean
  theme: UiTheme
}

const BASE_SHORTCUT_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["?", "show/hide shortcuts"],
  ["b", "⎇ change branch"],
  ["h", "◷ open commit history"],
  ["space", "include/exclude file in commit"],
  ["↑ / ↓", "move file selection"],
  ["r", "↻ refresh"],
  ["f", "⇣ fetch"],
  ["p", "⇩ pull"],
  ["ctrl+p", "⇧ push"],
]

export function ShortcutsDialog({ open, aiCommitEnabled, theme }: ShortcutsDialogProps) {
  if (!open) return null
  const commitRow: readonly [string, string] = aiCommitEnabled
    ? ["c", "✦ generate AI commit"]
    : ["c", "✓ open commit dialog"]
  const rows = [...BASE_SHORTCUT_ROWS, commitRow, ["esc", "close dialog or exit"]] as const

  return (
    <ViewFrame>
      <box style={{ width: "100%", flexDirection: "column", gap: 1 }}>
        <text fg={theme.colors.title}>shortcuts</text>
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {rows.map(([key, description]) => (
            <box key={key} style={{ flexDirection: "row", gap: 2 }}>
              <text fg={theme.colors.hintText}>{key.padEnd(8, " ")}</text>
              <text fg={theme.colors.text}>{description}</text>
            </box>
          ))}
        </box>
      </box>
    </ViewFrame>
  )
}
