type TopBarProps = {
  currentBranch: string
  showShortcutsHint: boolean
}

export function TopBar({ currentBranch, showShortcutsHint }: TopBarProps) {
  return (
    <box
      style={{ height: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 1, paddingRight: 1 }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg="#737373">⎇</text>
        <text fg="#f3f4f6">{currentBranch}</text>
      </box>
      {showShortcutsHint ? <text fg="#525252">[?] shortcuts</text> : null}
    </box>
  )
}
