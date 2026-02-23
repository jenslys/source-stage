import type { SelectOption } from "@opentui/core"

import type { UiTheme } from "../theme"
import type { FocusTarget } from "../types"

type CommitHistoryDialogProps = {
  open: boolean
  mode: "list" | "action"
  focus: FocusTarget
  terminalHeight: number
  currentBranch: string
  commitOptions: SelectOption[]
  commitIndex: number
  actionOptions: SelectOption[]
  actionIndex: number
  selectedCommitTitle: string
  theme: UiTheme
}

export function CommitHistoryDialog({
  open,
  mode,
  focus,
  terminalHeight,
  currentBranch,
  commitOptions,
  commitIndex,
  actionOptions,
  actionIndex,
  selectedCommitTitle,
  theme,
}: CommitHistoryDialogProps) {
  if (!open) return null
  const visibleRows = Math.max(4, terminalHeight - 16)
  const commitRange = getVisibleRange(commitOptions.length, commitIndex, visibleRows)
  const actionRange = getVisibleRange(actionOptions.length, actionIndex, visibleRows)

  return (
    <box
      style={{
        width: "100%",
        flexGrow: 1,
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
            <box style={{ width: "100%", flexDirection: "column" }}>
              {commitOptions.slice(commitRange.start, commitRange.end).map((option, visibleIndex) => {
                const absoluteIndex = commitRange.start + visibleIndex
                const selected = absoluteIndex === commitIndex
                const optionName = option.name ?? String(option.value ?? "")
                const optionDescription = option.description ?? ""
                return (
                  <box key={`${optionName}-${absoluteIndex}`} style={{ flexDirection: "column", ...(selected ? { backgroundColor: theme.colors.selectSelectedBackground } : {}) }}>
                    <text fg={selected ? theme.colors.selectSelectedText : theme.colors.text}>
                      {selected ? "▶ " : "  "}
                      {optionName}
                    </text>
                    {optionDescription ? <text fg={theme.colors.subtleText}>  {optionDescription}</text> : null}
                  </box>
                )
              })}
            </box>
          </>
        ) : (
          <>
            <text fg={theme.colors.text}>{selectedCommitTitle}</text>
            <text fg={theme.colors.subtleText}>choose action | enter confirm | esc back</text>
            <box style={{ width: "100%", flexDirection: "column" }}>
              {actionOptions.slice(actionRange.start, actionRange.end).map((option, visibleIndex) => {
                const absoluteIndex = actionRange.start + visibleIndex
                const selected = absoluteIndex === actionIndex
                const optionName = option.name ?? String(option.value ?? "")
                const optionDescription = option.description ?? ""
                return (
                  <box key={`${optionName}-${absoluteIndex}`} style={{ flexDirection: "column", ...(selected ? { backgroundColor: theme.colors.selectSelectedBackground } : {}) }}>
                    <text fg={selected ? theme.colors.selectSelectedText : theme.colors.text}>
                      {selected ? "▶ " : "  "}
                      {optionName}
                    </text>
                    {optionDescription ? <text fg={theme.colors.subtleText}>  {optionDescription}</text> : null}
                  </box>
                )
              })}
            </box>
          </>
        )}
      </box>
    </box>
  )
}

function getVisibleRange(total: number, selectedIndex: number, windowSize: number): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 }
  const safeSize = Math.max(windowSize, 1)
  const maxStart = Math.max(total - safeSize, 0)
  const centeredStart = Math.max(selectedIndex - Math.floor(safeSize / 2), 0)
  const start = Math.min(centeredStart, maxStart)
  return { start, end: Math.min(start + safeSize, total) }
}
