import type { InputRenderable, SelectOption } from "@opentui/core"
import type { RefObject } from "react"

import type { UiTheme } from "../theme"
import type { FocusTarget } from "../types"

type BranchDialogProps = {
  open: boolean
  mode: "select" | "create" | "confirm"
  focus: FocusTarget
  terminalHeight: number
  currentBranch: string
  branchOptions: SelectOption[]
  branchIndex: number
  branchStrategyOptions: SelectOption[]
  branchStrategyIndex: number
  branchName: string
  branchNameRef: RefObject<InputRenderable | null>
  onBranchNameInput: (value: string) => void
  theme: UiTheme
}

export function BranchDialog({
  open,
  mode,
  focus,
  terminalHeight,
  currentBranch,
  branchOptions,
  branchIndex,
  branchStrategyOptions,
  branchStrategyIndex,
  branchName,
  branchNameRef,
  onBranchNameInput,
  theme,
}: BranchDialogProps) {
  if (!open) return null
  const visibleOptionRows = Math.max(4, terminalHeight - 16)
  const branchRange = getVisibleRange(branchOptions.length, branchIndex, visibleOptionRows)
  const strategyRange = getVisibleRange(branchStrategyOptions.length, branchStrategyIndex, visibleOptionRows)

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
        {mode === "select" ? (
          <>
            <text fg={theme.colors.subtleText}>enter to checkout | select & enter to create branch | esc to close</text>
            <box style={{ width: "100%", flexDirection: "column" }}>
              {branchOptions.slice(branchRange.start, branchRange.end).map((option, visibleIndex) => {
                const absoluteIndex = branchRange.start + visibleIndex
                const selected = absoluteIndex === branchIndex
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
        ) : mode === "confirm" ? (
          <>
            <text fg={theme.colors.subtleText}>what should happen to your working changes? | enter to continue | esc to go back</text>
            <box style={{ width: "100%", flexDirection: "column" }}>
              {branchStrategyOptions.slice(strategyRange.start, strategyRange.end).map((option, visibleIndex) => {
                const absoluteIndex = strategyRange.start + visibleIndex
                const selected = absoluteIndex === branchStrategyIndex
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
            <text fg={theme.colors.subtleText}>enter to create and checkout | invalid chars become "-" | esc to go back</text>
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

function getVisibleRange(total: number, selectedIndex: number, windowSize: number): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 }
  const safeSize = Math.max(windowSize, 1)
  const maxStart = Math.max(total - safeSize, 0)
  const centeredStart = Math.max(selectedIndex - Math.floor(safeSize / 2), 0)
  const start = Math.min(centeredStart, maxStart)
  return { start, end: Math.min(start + safeSize, total) }
}
