type ShortcutsDialogProps = {
  open: boolean
  aiCommitEnabled: boolean
}

const BASE_SHORTCUT_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["?", "show/hide shortcuts"],
  ["b", "⎇ change branch"],
  ["h", "◷ open commit history"],
  ["space", "include/exclude file in commit"],
  ["↑ / ↓", "move file selection"],
  ["r", "↻ refresh"],
  ["f", "⇣ fetch"],
  ["l", "⇩ pull"],
  ["p", "⇧ push"],
]

export function ShortcutsDialog({ open, aiCommitEnabled }: ShortcutsDialogProps) {
  if (!open) return null
  const commitRow: readonly [string, string] = aiCommitEnabled
    ? ["c", "✦ generate AI commit"]
    : ["c", "✓ open commit dialog"]
  const rows = [...BASE_SHORTCUT_ROWS, commitRow, ["esc", "close dialog or exit"]] as const

  return (
    <box
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#000000",
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <box style={{ width: "100%", maxWidth: 72, flexDirection: "column", gap: 1 }}>
        <text fg="#f5f5f5">shortcuts</text>
        <text fg="#525252">press ? or esc to close</text>
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {rows.map(([key, description]) => (
            <box key={key} style={{ flexDirection: "row", gap: 2 }}>
              <text fg="#9ca3af">{key.padEnd(8, " ")}</text>
              <text fg="#f3f4f6">{description}</text>
            </box>
          ))}
        </box>
      </box>
    </box>
  )
}
