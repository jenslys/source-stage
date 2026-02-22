type TopBarProps = {
  currentBranch: string
}

export function TopBar({ currentBranch }: TopBarProps) {
  return (
    <box
      style={{ height: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 1, paddingRight: 1 }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg="#737373">on</text>
        <text fg="#f3f4f6">{currentBranch}</text>
      </box>
      <text fg="#525252">? shortcuts</text>
    </box>
  )
}
