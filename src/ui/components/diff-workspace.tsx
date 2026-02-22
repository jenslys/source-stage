import { DIFF_SYNTAX_STYLE } from "../diff-style"
import type { FileRow, FocusTarget } from "../types"

type DiffWorkspaceProps = {
  fileRows: FileRow[]
  fileIndex: number
  selectedFilePath: string | null
  focus: FocusTarget
  terminalHeight: number
  diffText: string
  diffMessage: string | null
  diffFiletype: string | undefined
}

export function DiffWorkspace({
  fileRows,
  fileIndex,
  selectedFilePath,
  focus,
  terminalHeight,
  diffText,
  diffMessage,
  diffFiletype,
}: DiffWorkspaceProps) {
  const visibleRows = Math.max(1, terminalHeight - 6)
  const { start, end } = getVisibleRange(fileRows.length, fileIndex, visibleRows)
  const rows = fileRows.slice(start, end)

  return (
    <box style={{ flexDirection: "row", flexGrow: 1, gap: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ width: 42, flexDirection: "column" }}>
        <text fg="#737373">changes ({fileRows.length})</text>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          {rows.map((row, rowIndex) => {
            const absoluteIndex = start + rowIndex
            const selected = absoluteIndex === fileIndex
            return (
              <box key={row.path} style={{ height: 1, flexDirection: "row", backgroundColor: selected ? "#101010" : "#000000" }}>
                <text fg={selected ? "#f3f4f6" : "#d1d5db"}>[{row.included ? "x" : " "}]</text>
                <text fg={row.statusColor}>{row.statusSymbol}</text>
                <text fg="#525252"> </text>
                {row.directory ? <text fg="#525252">{row.directory}</text> : null}
                <text fg={selected || focus === "files" ? "#f9fafb" : "#f3f4f6"}>{row.filename}</text>
              </box>
            )
          })}
        </box>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text fg="#737373">{selectedFilePath ?? "no file selected"}</text>
        {diffMessage ? (
          <box style={{ width: "100%", height: "100%", paddingLeft: 1, paddingTop: 1 }}>
            <text fg="#4b5563">{diffMessage}</text>
          </box>
        ) : (
          <diff
            key={selectedFilePath ?? "no-selection"}
            diff={diffText}
            view="unified"
            filetype={diffFiletype}
            syntaxStyle={DIFF_SYNTAX_STYLE}
            showLineNumbers={true}
            wrapMode="none"
            lineNumberFg="#525252"
            lineNumberBg="#000000"
            contextBg="#000000"
            contextContentBg="#000000"
            addedBg="#06180c"
            removedBg="#220909"
            addedContentBg="#06180c"
            removedContentBg="#220909"
            addedLineNumberBg="#0a2212"
            removedLineNumberBg="#2c1010"
            fg="#e5e7eb"
            style={{ width: "100%", height: "100%" }}
          />
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
