import type { SelectOption } from "@opentui/core"

import type { FocusTarget } from "../types"

type CommitHistoryDialogProps = {
  open: boolean
  mode: "list" | "action"
  focus: FocusTarget
  currentBranch: string
  commitOptions: SelectOption[]
  commitIndex: number
  onCommitChange: (index: number) => void
  actionOptions: SelectOption[]
  actionIndex: number
  onActionChange: (index: number) => void
  selectedCommitTitle: string
}

export function CommitHistoryDialog({
  open,
  mode,
  focus,
  currentBranch,
  commitOptions,
  commitIndex,
  onCommitChange,
  actionOptions,
  actionIndex,
  onActionChange,
  selectedCommitTitle,
}: CommitHistoryDialogProps) {
  if (!open) return null

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
      <box style={{ width: "100%", maxWidth: 96, flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <text fg="#f5f5f5">commit history</text>
        <text fg="#525252">current branch: {currentBranch}</text>

        {mode === "list" ? (
          <>
            <text fg="#525252">enter to choose action for selected commit | esc to close</text>
            <select
              style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
              options={commitOptions}
              selectedIndex={commitIndex}
              showDescription={true}
              focused={focus === "history-commits"}
              selectedBackgroundColor="#111111"
              selectedTextColor="#ffffff"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f3f4f6"
              onChange={onCommitChange}
            />
          </>
        ) : (
          <>
            <text fg="#f3f4f6">{selectedCommitTitle}</text>
            <text fg="#525252">choose action | enter confirm | esc back</text>
            <select
              style={{ width: "100%", height: 4, backgroundColor: "#000000", textColor: "#9ca3af" }}
              options={actionOptions}
              selectedIndex={actionIndex}
              showDescription={true}
              focused={focus === "history-actions"}
              selectedBackgroundColor="#111111"
              selectedTextColor="#ffffff"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f3f4f6"
              onChange={onActionChange}
            />
          </>
        )}
      </box>
    </box>
  )
}
