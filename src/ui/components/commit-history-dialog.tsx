import type { SelectOption } from "@opentui/core"

import { getPaneWidths, resolveRowBackground, resolveRowTextColor } from "./commit-history/layout"
import { getVisibleRange } from "../list-range"
import type { FocusTarget } from "../types"
import { fitLine, fitPathForWidth } from "../utils"
import type { UiTheme } from "../theme"
import type { CommitHistoryMode } from "../types"

type CommitHistoryDialogProps = {
  open: boolean
  mode: CommitHistoryMode
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  currentBranch: string
  commitOptions: SelectOption[]
  commitIndex: number
  actionOptions: SelectOption[]
  actionIndex: number
  fileOptions: SelectOption[]
  fileIndex: number
  selectedCommitTitle: string
  selectedCommitPreviewTitle: string
  selectedFilePath: string
  diffText: string
  diffMessage: string | null
  diffFiletype: string | undefined
  diffView: "unified" | "split"
  onCommitClick: (index: number) => void
  onFileClick: (index: number) => void
  onActionClick: (index: number) => void
  onCommitScroll: (direction: "up" | "down") => void
  onFileScroll: (direction: "up" | "down") => void
  onActionScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function CommitHistoryDialog({
  open,
  mode,
  focus,
  terminalWidth,
  terminalHeight,
  currentBranch,
  commitOptions,
  commitIndex,
  actionOptions,
  actionIndex,
  fileOptions,
  fileIndex,
  selectedCommitTitle,
  selectedCommitPreviewTitle,
  selectedFilePath,
  diffText,
  diffMessage,
  diffFiletype,
  diffView,
  onCommitClick,
  onFileClick,
  onActionClick,
  onCommitScroll,
  onFileScroll,
  onActionScroll,
  theme,
}: CommitHistoryDialogProps) {
  if (!open) return null
  const visibleRows = Math.max(1, terminalHeight - 14)
  const { commitsPaneWidth, filesPaneWidth } = getPaneWidths(terminalWidth)
  const commitRowWidth = Math.max(commitsPaneWidth - 4, 1)
  const fileRowWidth = Math.max(filesPaneWidth - 4, 1)
  const commitRange = getVisibleRange(commitOptions.length, commitIndex, visibleRows)
  const actionRange = getVisibleRange(actionOptions.length, actionIndex, visibleRows)
  const fileRange = getVisibleRange(fileOptions.length, fileIndex, visibleRows)
  const leftPaneTitle = mode === "list" ? `commits (${commitOptions.length})` : "actions"
  const selectedPreviewTitle = mode === "action" ? selectedCommitTitle : selectedCommitPreviewTitle
  const rightPaneTitle = selectedFilePath || selectedPreviewTitle || "no file selected"
  const commitsFocused =
    mode === "action" ? focus === "history-actions" : focus === "history-commits"
  const filesFocused = mode === "list" && focus === "history-files"

  return (
    <box
      style={{
        width: "100%",
        flexGrow: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", flexDirection: "column", gap: 1, flexGrow: 1 }}>
        <text fg={theme.colors.title}>commit history</text>
        <text fg={theme.colors.subtleText}>current branch: {currentBranch}</text>
        <text fg={theme.colors.subtleText}>
          {mode === "list"
            ? "tab: commits/files | enter: choose action | esc: close"
            : "up/down choose action | enter confirm | esc back"}
        </text>

        <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
          <box style={{ width: commitsPaneWidth, flexDirection: "column" }}>
            <text fg={commitsFocused ? theme.colors.inputFocusedText : theme.colors.subtleText}>
              {leftPaneTitle}
            </text>
            <box
              style={{ flexDirection: "column", flexGrow: 1 }}
              onMouseScroll={(event) => {
                const direction = event.scroll?.direction
                if (direction !== "up" && direction !== "down") return
                event.preventDefault()
                event.stopPropagation()
                if (mode === "action") {
                  onActionScroll(direction)
                } else {
                  onCommitScroll(direction)
                }
              }}
            >
              {mode === "list"
                ? commitOptions
                    .slice(commitRange.start, commitRange.end)
                    .map((option, visibleIndex) => {
                      const absoluteIndex = commitRange.start + visibleIndex
                      const selected = absoluteIndex === commitIndex
                      const optionName = option.name ?? String(option.value ?? "")
                      const optionDescription = option.description ?? ""
                      const label = optionDescription
                        ? `${optionDescription}  ${optionName}`
                        : optionName

                      return (
                        <box
                          key={`${optionName}-${absoluteIndex}`}
                          style={{
                            height: 1,
                            flexDirection: "row",
                            ...resolveRowBackground({
                              selected,
                              focused: focus === "history-commits",
                              theme,
                            }),
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onCommitClick(absoluteIndex)
                          }}
                        >
                          <text
                            fg={resolveRowTextColor({
                              selected,
                              focused: focus === "history-commits",
                              theme,
                            })}
                          >
                            {selected ? "▶ " : "  "}
                            {fitLine(label, commitRowWidth)}
                          </text>
                        </box>
                      )
                    })
                : actionOptions
                    .slice(actionRange.start, actionRange.end)
                    .map((option, visibleIndex) => {
                      const absoluteIndex = actionRange.start + visibleIndex
                      const selected = absoluteIndex === actionIndex
                      const optionName = option.name ?? String(option.value ?? "")
                      const optionDescription = option.description ?? ""
                      const label = optionDescription
                        ? `${optionName} - ${optionDescription}`
                        : optionName

                      return (
                        <box
                          key={`${optionName}-${absoluteIndex}`}
                          style={{
                            height: 1,
                            flexDirection: "row",
                            ...resolveRowBackground({
                              selected,
                              focused: focus === "history-actions",
                              theme,
                            }),
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onActionClick(absoluteIndex)
                          }}
                        >
                          <text
                            fg={resolveRowTextColor({
                              selected,
                              focused: focus === "history-actions",
                              theme,
                            })}
                          >
                            {selected ? "▶ " : "  "}
                            {fitLine(label, commitRowWidth)}
                          </text>
                        </box>
                      )
                    })}
            </box>
          </box>

          <box style={{ width: filesPaneWidth, flexDirection: "column" }}>
            <text fg={filesFocused ? theme.colors.inputFocusedText : theme.colors.subtleText}>
              files ({fileOptions.length})
            </text>
            <box
              style={{ flexDirection: "column", flexGrow: 1 }}
              onMouseScroll={(event) => {
                const direction = event.scroll?.direction
                if (direction !== "up" && direction !== "down") return
                event.preventDefault()
                event.stopPropagation()
                onFileScroll(direction)
              }}
            >
              {fileOptions.slice(fileRange.start, fileRange.end).map((option, visibleIndex) => {
                const absoluteIndex = fileRange.start + visibleIndex
                const selected = absoluteIndex === fileIndex
                const optionName = option.name ?? String(option.value ?? "")
                const optionDescription = option.description ?? ""
                const prefix = optionDescription ? `${optionDescription}  ` : ""
                const pathWidth = Math.max(fileRowWidth - prefix.length, 0)
                const label = `${prefix}${fitPathForWidth(optionName, pathWidth)}`

                return (
                  <box
                    key={`${optionName}-${absoluteIndex}`}
                    style={{
                      height: 1,
                      flexDirection: "row",
                      ...resolveRowBackground({
                        selected,
                        focused: focus === "history-files",
                        theme,
                      }),
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onFileClick(absoluteIndex)
                    }}
                  >
                    <text
                      fg={resolveRowTextColor({
                        selected,
                        focused: focus === "history-files",
                        theme,
                      })}
                    >
                      {selected ? "▶ " : "  "}
                      {fitLine(label, fileRowWidth)}
                    </text>
                  </box>
                )
              })}
            </box>
          </box>

          <box style={{ flexGrow: 1, flexDirection: "column" }}>
            <text fg={theme.colors.mutedText}>{rightPaneTitle}</text>
            {diffMessage ? (
              <box style={{ width: "100%", height: "100%", paddingLeft: 1, paddingTop: 1 }}>
                <text fg={theme.colors.subtleText}>{diffMessage}</text>
              </box>
            ) : (
              <diff
                key={rightPaneTitle || "history-no-selection"}
                diff={diffText}
                view={diffView}
                filetype={diffFiletype}
                syntaxStyle={theme.diffSyntaxStyle}
                showLineNumbers={true}
                wrapMode="none"
                lineNumberFg={theme.colors.diffLineNumber}
                addedBg={theme.colors.diffAddedBackground}
                removedBg={theme.colors.diffRemovedBackground}
                addedContentBg={theme.colors.diffAddedBackground}
                removedContentBg={theme.colors.diffRemovedBackground}
                addedLineNumberBg={theme.colors.diffAddedLineNumberBackground}
                removedLineNumberBg={theme.colors.diffRemovedLineNumberBackground}
                fg={theme.colors.diffForeground}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </box>
        </box>
      </box>
    </box>
  )
}
