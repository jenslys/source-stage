import type { SelectOption } from "@opentui/core"

import type { UiTheme } from "../theme"
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
  theme: UiTheme
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
  theme,
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
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <box style={{ width: "100%", maxWidth: 96, flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <text fg={theme.colors.title}>commit history</text>
        <text fg={theme.colors.subtleText}>current branch: {currentBranch}</text>

        {mode === "list" ? (
          <>
            <text fg={theme.colors.subtleText}>enter to choose action for selected commit | esc to close</text>
            <select
              style={{ width: "100%", height: "100%", textColor: theme.colors.selectText }}
              options={commitOptions}
              selectedIndex={commitIndex}
              showDescription={true}
              focused={focus === "history-commits"}
              selectedBackgroundColor={theme.colors.selectSelectedBackground}
              selectedTextColor={theme.colors.selectSelectedText}
              focusedTextColor={theme.colors.selectFocusedText}
              onChange={onCommitChange}
            />
          </>
        ) : (
          <>
            <text fg={theme.colors.text}>{selectedCommitTitle}</text>
            <text fg={theme.colors.subtleText}>choose action | enter confirm | esc back</text>
            <select
              style={{ width: "100%", height: 4, textColor: theme.colors.selectText }}
              options={actionOptions}
              selectedIndex={actionIndex}
              showDescription={true}
              focused={focus === "history-actions"}
              selectedBackgroundColor={theme.colors.selectSelectedBackground}
              selectedTextColor={theme.colors.selectSelectedText}
              focusedTextColor={theme.colors.selectFocusedText}
              onChange={onActionChange}
            />
          </>
        )}
      </box>
    </box>
  )
}
