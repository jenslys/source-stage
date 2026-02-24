import type { InputRenderable, SelectOption } from "@opentui/core"
import type { RefObject } from "react"

import { SectionDivider } from "./section-divider"
import type { UiTheme } from "../theme"
import type { BranchDialogMode, FocusTarget } from "../types"
import { getVisibleRange } from "../list-range"
import { fitLine } from "../utils"

type BranchDialogProps = {
  open: boolean
  mode: BranchDialogMode
  focus: FocusTarget
  terminalWidth: number
  terminalHeight: number
  currentBranch: string
  branchOptions: SelectOption[]
  branchIndex: number
  branchStrategyOptions: SelectOption[]
  branchStrategyIndex: number
  branchName: string
  branchNameRef: RefObject<InputRenderable | null>
  onBranchNameInput: (value: string) => void
  onBranchClick: (index: number) => void
  onBranchStrategyClick: (index: number) => void
  onBranchScroll: (direction: "up" | "down") => void
  onBranchStrategyScroll: (direction: "up" | "down") => void
  theme: UiTheme
}

export function BranchDialog({
  open,
  mode,
  focus,
  terminalWidth,
  terminalHeight,
  currentBranch,
  branchOptions,
  branchIndex,
  branchStrategyOptions,
  branchStrategyIndex,
  branchName,
  branchNameRef,
  onBranchNameInput,
  onBranchClick,
  onBranchStrategyClick,
  onBranchScroll,
  onBranchStrategyScroll,
  theme,
}: BranchDialogProps) {
  if (!open) return null
  const visibleOptionRows = Math.max(1, terminalHeight - 16)
  const createOption = branchOptions[0]
  const checkoutOptions = branchOptions.slice(1)
  const checkoutSelectedIndex = Math.max(branchIndex - 1, 0)
  const visibleCheckoutRows = Math.max(1, visibleOptionRows - 2)
  const checkoutRange = getVisibleRange(
    checkoutOptions.length,
    checkoutSelectedIndex,
    visibleCheckoutRows,
  )
  const strategyRange = getVisibleRange(
    branchStrategyOptions.length,
    branchStrategyIndex,
    visibleOptionRows,
  )
  const rowWidth = Math.max(Math.min(terminalWidth - 18, 80), 12)
  const labelWidth = Math.max(rowWidth - 2, 1)

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
      <box style={{ width: "100%", maxWidth: 88, gap: 1, flexDirection: "column", flexGrow: 1 }}>
        <text fg={theme.colors.title}>change branch</text>
        <text fg={theme.colors.subtleText}>current: {currentBranch}</text>
        <SectionDivider theme={theme} />
        {mode === "select" ? (
          <>
            <text fg={theme.colors.subtleText}>
              enter to checkout | select & enter to create branch | esc to close
            </text>
            <box
              style={{ width: "100%", flexDirection: "column" }}
              onMouseScroll={(event) => {
                const direction = event.scroll?.direction
                if (direction !== "up" && direction !== "down") return
                event.preventDefault()
                event.stopPropagation()
                onBranchScroll(direction)
              }}
            >
              {createOption ? (
                <box
                  key={`create-${String(createOption.value ?? createOption.name ?? "")}`}
                  style={{
                    width: "100%",
                    height: 1,
                    flexDirection: "row",
                    ...(branchIndex === 0
                      ? { backgroundColor: theme.colors.selectSelectedBackground }
                      : {}),
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onBranchClick(0)
                  }}
                >
                  <text
                    style={{ width: "100%" }}
                    fg={branchIndex === 0 ? theme.colors.selectSelectedText : theme.colors.text}
                  >
                    {branchIndex === 0 ? "▶ " : "  "}
                    {fitLine(createOption.name ?? String(createOption.value ?? ""), labelWidth)}
                  </text>
                </box>
              ) : null}
              {checkoutOptions.length > 0 ? (
                <box style={{ width: "100%", height: 1, flexDirection: "row" }}>
                  <text style={{ width: "100%" }} fg={theme.colors.subtleText}>
                    {fitLine("checkout branches", labelWidth)}
                  </text>
                </box>
              ) : null}
              {checkoutOptions
                .slice(checkoutRange.start, checkoutRange.end)
                .map((option, visibleIndex) => {
                  const absoluteIndex = checkoutRange.start + visibleIndex + 1
                  const selected = absoluteIndex === branchIndex
                  const optionName = option.name ?? String(option.value ?? "")
                  const isCurrentBranch = (option.description ?? "").length > 0
                  const marker = isCurrentBranch ? "● " : "  "
                  const label = `${marker}${optionName}`
                  return (
                    <box
                      key={`${optionName}-${absoluteIndex}`}
                      style={{
                        width: "100%",
                        height: 1,
                        flexDirection: "row",
                        ...(selected
                          ? { backgroundColor: theme.colors.selectSelectedBackground }
                          : {}),
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onBranchClick(absoluteIndex)
                      }}
                    >
                      <text
                        style={{ width: "100%" }}
                        fg={selected ? theme.colors.selectSelectedText : theme.colors.text}
                      >
                        {selected ? "▶ " : "  "}
                        {fitLine(label, labelWidth)}
                      </text>
                    </box>
                  )
                })}
            </box>
          </>
        ) : mode === "confirm" ? (
          <>
            <text fg={theme.colors.subtleText}>
              what should happen to your working changes? | enter to continue | esc to go back
            </text>
            <box
              style={{ width: "100%", flexDirection: "column" }}
              onMouseScroll={(event) => {
                const direction = event.scroll?.direction
                if (direction !== "up" && direction !== "down") return
                event.preventDefault()
                event.stopPropagation()
                onBranchStrategyScroll(direction)
              }}
            >
              {branchStrategyOptions
                .slice(strategyRange.start, strategyRange.end)
                .map((option, visibleIndex) => {
                  const absoluteIndex = strategyRange.start + visibleIndex
                  const selected = absoluteIndex === branchStrategyIndex
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
                        ...(selected
                          ? { backgroundColor: theme.colors.selectSelectedBackground }
                          : {}),
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onBranchStrategyClick(absoluteIndex)
                      }}
                    >
                      <text
                        style={{ width: "100%" }}
                        fg={selected ? theme.colors.selectSelectedText : theme.colors.text}
                      >
                        {selected ? "▶ " : "  "}
                        {fitLine(label, labelWidth)}
                      </text>
                    </box>
                  )
                })}
            </box>
          </>
        ) : (
          <>
            <text fg={theme.colors.subtleText}>
              enter to create and checkout | invalid chars become "-" | esc to go back
            </text>
            <input
              ref={branchNameRef}
              value={branchName}
              onInput={onBranchNameInput}
              placeholder="new branch name"
              focused={focus === "branch-create"}
              textColor={theme.colors.inputText}
              focusedTextColor={theme.colors.inputFocusedText}
            />
          </>
        )}
      </box>
    </box>
  )
}
