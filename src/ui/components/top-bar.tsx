type TopBarProps = {
  currentBranch: string
}

export function TopBar({ currentBranch }: TopBarProps) {
  return (
    <box style={{ height: 3, flexDirection: "row", alignItems: "center", paddingLeft: 1, paddingRight: 1, gap: 1 }}>
      <text fg="#737373">on</text>
      <text fg="#f3f4f6">{currentBranch}</text>
      <box style={{ flexGrow: 1, justifyContent: "center" }}>
        <text fg="#525252">[b] change branch   [r] refresh   [f] fetch   [l] pull   [p] push   [c] commit   [u] include/exclude</text>
      </box>
    </box>
  )
}
