import type { SelectOption } from "@opentui/core"

import type { FocusTarget } from "../types"

type TopBarProps = {
  branchOptions: SelectOption[]
  branchOptionsKey: string
  branchIndex: number
  focus: FocusTarget
  onBranchChange: (index: number) => void
  onBranchSelect: (index: number, option: SelectOption | null) => void
}

export function TopBar({
  branchOptions,
  branchOptionsKey,
  branchIndex,
  focus,
  onBranchChange,
  onBranchSelect,
}: TopBarProps) {
  return (
    <box style={{ height: 3, flexDirection: "row", alignItems: "center", paddingLeft: 1, paddingRight: 1, gap: 1 }}>
      <text fg="#737373">branch</text>
      <box style={{ width: 34, height: 1 }}>
        <select
          key={branchOptionsKey}
          style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
          options={branchOptions}
          selectedIndex={branchIndex}
          showDescription={false}
          focused={focus === "branch"}
          selectedBackgroundColor="#111111"
          selectedTextColor="#ffffff"
          focusedBackgroundColor="#000000"
          focusedTextColor="#f3f4f6"
          onChange={onBranchChange}
          onSelect={onBranchSelect}
        />
      </box>
      <box style={{ flexGrow: 1, justifyContent: "center" }}>
        <text fg="#525252">[b] change branch   [r] refresh   [f] fetch   [l] pull   [p] push   [c] commit   [u] include/exclude</text>
      </box>
    </box>
  )
}
