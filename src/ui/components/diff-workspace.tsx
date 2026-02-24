import type { UiTheme } from "../theme"
import type { FileRow, FocusTarget } from "../types"

type DiffWorkspaceProps = {
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
  const { start, end } = getVisibleRange(fileRows.length, fileIndex, visibleRows)
  const rows = fileRows.slice(start, end)

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
          {rows.map((row, rowIndex) => {
            const absoluteIndex = start + rowIndex
            const selected = absoluteIndex === fileIndex
            return (
              <box
                key={row.path}
                style={{ height: 1, flexDirection: "row", ...(selected ? { backgroundColor: theme.colors.selectedRowBackground } : {}) }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onFileClick(absoluteIndex)
                }}
              >
                <text fg={row.included ? theme.colors.text : theme.colors.subtleText}>{row.included ? "[x]" : "[ ]"}</text>
                <text fg={theme.colors.subtleText}> </text>
                <text fg={row.statusColor}>{row.statusSymbol}</text>
                <text fg={theme.colors.subtleText}> </text>
                {row.directory ? <text fg={theme.colors.subtleText}>{row.directory}</text> : null}
                <text fg={selected || focus === "files" ? theme.colors.inputFocusedText : theme.colors.text}>{row.filename}</text>
              </box>
            )
          })}
        </box>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text fg={theme.colors.mutedText}>{selectedFilePath ?? "no file selected"}</text>
        {diffMessage ? (
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

function getVisibleRange(total: number, selectedIndex: number, windowSize: number): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 }
  const safeSize = Math.max(windowSize, 1)
  const maxStart = Math.max(total - safeSize, 0)
  const centeredStart = Math.max(selectedIndex - Math.floor(safeSize / 2), 0)
  const start = Math.min(centeredStart, maxStart)
  return { start, end: Math.min(start + safeSize, total) }
}
