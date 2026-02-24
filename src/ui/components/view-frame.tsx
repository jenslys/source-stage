import type { ReactNode } from "react"

const VIEW_FRAME_PADDING_X = 2
const VIEW_FRAME_PADDING_TOP = 1
const VIEW_FRAME_PADDING_BOTTOM = 1
const MIN_VISIBLE_ROWS = 1

type ViewFrameProps = {
  children: ReactNode
  gap?: number
}

export function ViewFrame({ children, gap = 0 }: ViewFrameProps) {
  return (
    <box
      style={{
        width: "100%",
        flexGrow: 1,
        paddingLeft: VIEW_FRAME_PADDING_X,
        paddingRight: VIEW_FRAME_PADDING_X,
        paddingTop: VIEW_FRAME_PADDING_TOP,
        paddingBottom: VIEW_FRAME_PADDING_BOTTOM,
      }}
    >
      <box
        style={{
          width: "100%",
          flexGrow: 1,
          flexDirection: "column",
          gap,
        }}
      >
        {children}
      </box>
    </box>
  )
}

export function resolveViewContentWidth(terminalWidth: number): number {
  if (!Number.isFinite(terminalWidth) || terminalWidth <= 0) {
    return 80
  }

  return Math.max(terminalWidth - VIEW_FRAME_PADDING_X * 2, 1)
}

export function resolveVisibleRows(terminalHeight: number, reservedRows: number): number {
  if (!Number.isFinite(terminalHeight) || terminalHeight <= 0) {
    return MIN_VISIBLE_ROWS
  }

  return Math.max(MIN_VISIBLE_ROWS, terminalHeight - reservedRows)
}

export function resolveDenseVisibleRows(rows: number, rowHeight = 2): number {
  if (!Number.isFinite(rows) || rows <= 0) {
    return MIN_VISIBLE_ROWS
  }

  return Math.max(MIN_VISIBLE_ROWS, Math.floor(rows / Math.max(rowHeight, 1)))
}
