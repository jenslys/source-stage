import type { SelectOption } from "@opentui/core"

import { resolveRowBackground, resolveRowTextColor } from "./commit-history/layout"
import { SectionDivider } from "./section-divider"
import { getVisibleRange } from "../list-range"
import type { FocusTarget } from "../types"
import type { UiTheme } from "../theme"
import { fitLine, fitPathForWidth } from "../utils"
import { ViewFrame, resolveViewContentWidth, resolveVisibleRows } from "./view-frame"

type DiscardDialogProps = {
  open: boolean
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  path: string
  options: SelectOption[]
  optionIndex: number
  onOptionClick: (index: number) => void
  onOptionScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function DiscardDialog({
  open,
  focus,
  terminalWidth,
  terminalHeight,
  path,
  options,
  optionIndex,
  onOptionClick,
  onOptionScroll,
  theme,
}: DiscardDialogProps) {
  if (!open) return null
  const visibleRows = resolveVisibleRows(terminalHeight, 14)
  const contentWidth = resolveViewContentWidth(terminalWidth)
  const rowWidth = Math.max(contentWidth - 2, 1)
  const detailWidth = Math.max(rowWidth - 1, 1)
  const range = getVisibleRange(options.length, optionIndex, visibleRows)
  const pathLabel = fitPathForWidth(path, rowWidth)

  return (
    <ViewFrame gap={1}>
      <text fg={theme.colors.title}>discard file changes?</text>
      <text fg={theme.colors.subtleText}>{pathLabel}</text>
      <text fg={theme.colors.hintText}>this cannot be undone</text>
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
                  focused: focus === "discard-dialog-list",
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
                  focused: focus === "discard-dialog-list",
                  theme,
                })}
              >
                {prefix}
                {fitLine(optionName, titleWidth)}
              </text>
              <text fg={selected ? theme.colors.subtleText : theme.colors.hintText}>
                {" "}
                {fitLine(optionDescription, detailWidth)}
              </text>
            </box>
          )
        })}
      </box>
    </ViewFrame>
  )
}
