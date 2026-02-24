import type { SelectOption } from "@opentui/core"

import { resolveRowBackground, resolveRowTextColor } from "./commit-history/layout"
import { getVisibleRange } from "../list-range"
import type { FocusTarget } from "../types"
import type { UiTheme } from "../theme"
import { fitLine } from "../utils"
import { ViewFrame, resolveViewContentWidth, resolveVisibleRows } from "./view-frame"
import { SectionDivider } from "./section-divider"

type SyncDialogProps = {
  open: boolean
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  options: SelectOption[]
  optionIndex: number
  details: string | null
  onOptionClick: (index: number) => void
  onOptionScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function SyncDialog({
  open,
  focus,
  terminalWidth,
  terminalHeight,
  options,
  optionIndex,
  details,
  onOptionClick,
  onOptionScroll,
  theme,
}: SyncDialogProps) {
  if (!open) return null
  const visibleRows = resolveVisibleRows(terminalHeight, 14)
  const range = getVisibleRange(options.length, optionIndex, visibleRows)
  const rowWidth = Math.max(resolveViewContentWidth(terminalWidth) - 2, 1)

  return (
    <ViewFrame gap={1}>
      <text fg={theme.colors.title}>push rejected</text>
      <text fg={theme.colors.subtleText}>remote has new commits, choose how to sync first</text>
      {details ? <text fg={theme.colors.hintText}>{fitLine(details, rowWidth)}</text> : null}
      <SectionDivider theme={theme} />
      <box
        style={{ width: "100%", flexDirection: "column", flexGrow: 1 }}
        onMouseScroll={(event) => {
          const direction = event.scroll?.direction
          if (direction !== "up" && direction !== "down") return
          event.preventDefault()
          event.stopPropagation()
          onOptionScroll(direction)
        }}
      >
        {options.slice(range.start, range.end).map((option, visibleIndex) => {
          const absoluteIndex = range.start + visibleIndex
          const selected = absoluteIndex === optionIndex
          const optionName = option.name ?? String(option.value ?? "")
          const optionDescription = option.description ?? ""
          const prefix = selected ? "▶ " : "  "
          const titleWidth = Math.max(rowWidth - prefix.length, 1)
          return (
            <box
              key={`${optionName}-${absoluteIndex}`}
              style={{
                height: 2,
                flexDirection: "column",
                ...resolveRowBackground({
                  selected,
                  focused: focus === "sync-dialog-list",
                  theme,
                }),
              }}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOptionClick(absoluteIndex)
              }}
            >
              <text
                fg={resolveRowTextColor({
                  selected,
                  focused: focus === "sync-dialog-list",
                  theme,
                })}
              >
                {prefix}
                {fitLine(optionName, titleWidth)}
              </text>
              <text fg={selected ? theme.colors.subtleText : theme.colors.hintText}>
                {" "}
                {fitLine(optionDescription, rowWidth - 1)}
              </text>
            </box>
          )
        })}
      </box>
    </ViewFrame>
  )
}
