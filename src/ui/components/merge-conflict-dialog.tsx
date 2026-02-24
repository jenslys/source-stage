import type { SelectOption } from "@opentui/core"

import { getPaneWidths, resolveRowBackground, resolveRowTextColor } from "./commit-history/layout"
import { SectionDivider } from "./section-divider"
import { getVisibleRange } from "../list-range"
import type { FocusTarget } from "../types"
import { fitLine, fitPathForWidth } from "../utils"
import type { UiTheme } from "../theme"
import { ViewFrame, resolveViewContentWidth, resolveVisibleRows } from "./view-frame"

type MergeConflictDialogProps = {
  open: boolean
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  currentBranch: string
  details: string | null
  conflictFileOptions: SelectOption[]
  conflictFileIndex: number
  actionOptions: SelectOption[]
  actionIndex: number
  onConflictFileClick: (index: number) => void
  onConflictActionClick: (index: number) => void
  onConflictFileScroll: (direction: "up" | "down") => void
  onConflictActionScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function MergeConflictDialog({
  open,
  focus,
  terminalWidth,
  terminalHeight,
  currentBranch,
  details,
  conflictFileOptions,
  conflictFileIndex,
  actionOptions,
  actionIndex,
  onConflictFileClick,
  onConflictActionClick,
  onConflictFileScroll,
  onConflictActionScroll,
  theme,
}: MergeConflictDialogProps) {
  if (!open) return null
  const visibleRows = resolveVisibleRows(terminalHeight, 14)
  const contentWidth = resolveViewContentWidth(terminalWidth)
  const { commitsPaneWidth: filesPaneWidth } = getPaneWidths(contentWidth)
  const actionsPaneWidth = Math.max(contentWidth - filesPaneWidth - 1, 28)
  const fileRowWidth = Math.max(filesPaneWidth - 4, 1)
  const actionRowWidth = Math.max(actionsPaneWidth - 4, 1)
  const conflictRange = getVisibleRange(conflictFileOptions.length, conflictFileIndex, visibleRows)
  const actionRange = getVisibleRange(actionOptions.length, actionIndex, visibleRows)
  const filesFocused = focus === "merge-conflict-files"
  const actionsFocused = focus === "merge-conflict-actions"

  return (
    <ViewFrame gap={1}>
      <text fg={theme.colors.title}>finish merge</text>
      <text fg={theme.colors.subtleText}>branch: {currentBranch}</text>
      {conflictFileOptions.length > 0 ? (
        <text fg={theme.colors.hintText}>
          {conflictFileOptions.length} file{conflictFileOptions.length === 1 ? "" : "s"} still need
          attention
        </text>
      ) : (
        <text fg={theme.colors.hintText}>
          All conflict files are fixed. You can finish the merge.
        </text>
      )}
      <text fg={theme.colors.hintText}>enter on file opens editor or marks it done</text>
      {details ? (
        <text fg={theme.colors.hintText}>{fitLine(details, Math.max(contentWidth - 2, 1))}</text>
      ) : null}
      <SectionDivider theme={theme} />

      <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
        <box style={{ width: filesPaneWidth, flexDirection: "column" }}>
          <text fg={filesFocused ? theme.colors.inputFocusedText : theme.colors.subtleText}>
            files ({conflictFileOptions.length})
          </text>
          <box
            style={{ flexDirection: "column", flexGrow: 1 }}
            onMouseScroll={(event) => {
              const direction = event.scroll?.direction
              if (direction !== "up" && direction !== "down") return
              event.preventDefault()
              event.stopPropagation()
              onConflictFileScroll(direction)
            }}
          >
            {conflictFileOptions.length === 0 ? (
              <box style={{ paddingLeft: 1, paddingTop: 1 }}>
                <text fg={theme.colors.subtleText}>No files left to fix.</text>
              </box>
            ) : (
              conflictFileOptions
                .slice(conflictRange.start, conflictRange.end)
                .map((option, visibleIndex) => {
                  const absoluteIndex = conflictRange.start + visibleIndex
                  const selected = absoluteIndex === conflictFileIndex
                  const path = option.name ?? String(option.value ?? "")

                  return (
                    <box
                      key={`${path}-${absoluteIndex}`}
                      style={{
                        height: 1,
                        flexDirection: "row",
                        ...resolveRowBackground({
                          selected,
                          focused: filesFocused,
                          theme,
                        }),
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onConflictFileClick(absoluteIndex)
                      }}
                    >
                      <text
                        fg={resolveRowTextColor({
                          selected,
                          focused: filesFocused,
                          theme,
                        })}
                      >
                        {selected ? "▶ " : "  "}
                        {fitLine(fitPathForWidth(path, fileRowWidth), fileRowWidth)}
                      </text>
                    </box>
                  )
                })
            )}
          </box>
        </box>

        <box style={{ width: actionsPaneWidth, flexDirection: "column" }}>
          <text fg={actionsFocused ? theme.colors.inputFocusedText : theme.colors.subtleText}>
            next step
          </text>
          <box
            style={{ flexDirection: "column", flexGrow: 1 }}
            onMouseScroll={(event) => {
              const direction = event.scroll?.direction
              if (direction !== "up" && direction !== "down") return
              event.preventDefault()
              event.stopPropagation()
              onConflictActionScroll(direction)
            }}
          >
            {actionOptions.slice(actionRange.start, actionRange.end).map((option, visibleIndex) => {
              const absoluteIndex = actionRange.start + visibleIndex
              const selected = absoluteIndex === actionIndex
              const actionName = option.name ?? String(option.value ?? "")
              const actionDescription = option.description ?? ""
              const prefix = selected ? "▶ " : "  "
              const actionWidth = Math.max(actionRowWidth - prefix.length, 1)
              const detailWidth = Math.max(actionRowWidth - 2, 1)

              return (
                <box
                  key={`${actionName}-${absoluteIndex}`}
                  style={{
                    height: 2,
                    flexDirection: "column",
                    ...resolveRowBackground({
                      selected,
                      focused: actionsFocused,
                      theme,
                    }),
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onConflictActionClick(absoluteIndex)
                  }}
                >
                  <text
                    fg={resolveRowTextColor({
                      selected,
                      focused: actionsFocused,
                      theme,
                    })}
                  >
                    {prefix}
                    {fitLine(actionName, actionWidth)}
                  </text>
                  <text fg={selected ? theme.colors.subtleText : theme.colors.hintText}>
                    {" "}
                    {fitLine(actionDescription, detailWidth)}
                  </text>
                </box>
              )
            })}
          </box>
        </box>
      </box>
    </ViewFrame>
  )
}
