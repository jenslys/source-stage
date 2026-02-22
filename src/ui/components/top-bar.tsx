import type { UiTheme } from "../theme"

type TopBarProps = {
  currentBranch: string
  showShortcutsHint: boolean
  theme: UiTheme
}

export function TopBar({ currentBranch, showShortcutsHint, theme }: TopBarProps) {
  return (
    <box
      style={{ height: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 1, paddingRight: 1 }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={theme.colors.mutedText}>⎇</text>
        <text fg={theme.colors.text}>{currentBranch}</text>
      </box>
      {showShortcutsHint ? <text fg={theme.colors.subtleText}>[?] shortcuts</text> : null}
    </box>
  )
}
