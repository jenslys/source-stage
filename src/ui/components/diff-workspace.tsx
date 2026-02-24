import type { UiTheme } from "../theme"
import { getVisibleRange } from "../list-range"
import type { FileRow, FocusTarget } from "../types"
import { fitPathPartsForWidth } from "../utils"

type DiffWorkspaceProps = {
  hasSnapshot: boolean
  fileRows: FileRow[]
  fileIndex: number
  selectedFilePath: string | null
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  diffText: string
  diffMessage: string | null
  diffFiletype: string | undefined
  diffView: "unified" | "split"
  onFileClick: (index: number) => void
  onFileScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function DiffWorkspace({
  hasSnapshot,
  fileRows,
  fileIndex,
  selectedFilePath,
  focus,
  terminalWidth,
  terminalHeight,
  diffText,
  diffMessage,
  diffFiletype,
  diffView,
  onFileClick,
  onFileScroll,
  theme,
}: DiffWorkspaceProps) {
  const visibleRows = Math.max(1, terminalHeight - 6)
  const changesPaneWidth = getChangesPaneWidth(terminalWidth)
  const filePathWidth = Math.max(changesPaneWidth - 6, 1)
  const { start, end } = getVisibleRange(fileRows.length, fileIndex, visibleRows)
  const rows = fileRows.slice(start, end)
  const showLoadingState = !hasSnapshot
  const showCleanState = hasSnapshot && fileRows.length === 0
  const showUnselectedState = hasSnapshot && fileRows.length > 0 && !selectedFilePath
  const paneLabel =
    selectedFilePath ??
    (showLoadingState ? "loading" : showCleanState ? "overview" : "no file selected")

  return (
    <box style={{ flexDirection: "row", flexGrow: 1, gap: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ width: changesPaneWidth, flexDirection: "column" }}>
        <text fg={theme.colors.mutedText}>changes ({fileRows.length})</text>
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
          {rows.length === 0 ? (
            <box style={{ paddingLeft: 1, paddingTop: 1 }}>
              <text fg={theme.colors.subtleText}>
                {showLoadingState ? "loading changes..." : "working tree clean"}
              </text>
            </box>
          ) : (
            rows.map((row, rowIndex) => {
              const absoluteIndex = start + rowIndex
              const selected = absoluteIndex === fileIndex
              const fittedPath = fitPathPartsForWidth(row.directory, row.filename, filePathWidth)
              return (
                <box
                  key={row.path}
                  style={{
                    height: 1,
                    flexDirection: "row",
                    ...(selected ? { backgroundColor: theme.colors.selectedRowBackground } : {}),
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onFileClick(absoluteIndex)
                  }}
                >
                  <text fg={row.included ? theme.colors.text : theme.colors.subtleText}>
                    {row.included ? "[x]" : "[ ]"}
                  </text>
                  <text fg={theme.colors.subtleText}> </text>
                  <text fg={row.statusColor}>{row.statusSymbol}</text>
                  <text fg={theme.colors.subtleText}> </text>
                  {fittedPath.directory ? (
                    <text fg={theme.colors.subtleText}>{fittedPath.directory}</text>
                  ) : null}
                  <text
                    fg={
                      selected || focus === "files"
                        ? theme.colors.inputFocusedText
                        : theme.colors.text
                    }
                  >
                    {fittedPath.filename}
                  </text>
                </box>
              )
            })
          )}
        </box>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text fg={theme.colors.mutedText}>{paneLabel}</text>
        {showLoadingState ? (
          <EmptyStatePanel
            title="loading repository state..."
            subtitle="Fetching branch and working tree status."
            hint="r refresh  ? shortcuts"
            theme={theme}
          />
        ) : showCleanState ? (
          <EmptyStatePanel
            title="working tree clean"
            subtitle="No unstaged or staged changes in this repository."
            hint="r refresh  b branch  h history  ? shortcuts"
            theme={theme}
          />
        ) : showUnselectedState ? (
          <EmptyStatePanel
            title="select a file to preview diff"
            subtitle="Use ↑ / ↓ to change selection in the changes list."
            hint="space include/exclude  c commit  ? shortcuts"
            theme={theme}
          />
        ) : diffMessage ? (
          <box style={{ width: "100%", height: "100%", paddingLeft: 1, paddingTop: 1 }}>
            <text fg={theme.colors.subtleText}>{diffMessage}</text>
          </box>
        ) : (
          <diff
            key={selectedFilePath ?? "no-selection"}
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
  )
}

type EmptyStatePanelProps = {
  title: string
  subtitle: string
  hint: string
  theme: UiTheme
}

function EmptyStatePanel({ title, subtitle, hint, theme }: EmptyStatePanelProps) {
  return (
    <box style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
      <box
        style={{
          width: "100%",
          maxWidth: 62,
          flexDirection: "column",
          gap: 1,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text fg={theme.colors.text}>{title}</text>
        <text fg={theme.colors.subtleText}>{subtitle}</text>
        <text fg={theme.colors.hintText}>{hint}</text>
      </box>
    </box>
  )
}

function getChangesPaneWidth(terminalWidth: number): number {
  if (!Number.isFinite(terminalWidth) || terminalWidth <= 0) return 42
  const minimumWidth = 24
  const minimumDiffWidth = 48
  const preferredWidth = Math.floor(terminalWidth * 0.28)
  const maxAllowedWidth = Math.max(minimumWidth, terminalWidth - minimumDiffWidth)
  return clamp(preferredWidth, minimumWidth, maxAllowedWidth)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
