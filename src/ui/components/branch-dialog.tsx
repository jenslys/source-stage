import type { InputRenderable, SelectOption } from "@opentui/core"
import type { RefObject } from "react"

import type { UiTheme } from "../theme"
import type { FocusTarget } from "../types"

type BranchDialogProps = {
  open: boolean
  mode: "select" | "create" | "confirm"
  focus: FocusTarget
  currentBranch: string
  branchOptions: SelectOption[]
  branchOptionsKey: string
  branchIndex: number
  onBranchChange: (index: number) => void
  branchStrategyOptions: SelectOption[]
  branchStrategyIndex: number
  onBranchStrategyChange: (index: number) => void
  branchName: string
  branchNameRef: RefObject<InputRenderable | null>
  onBranchNameInput: (value: string) => void
  theme: UiTheme
}

export function BranchDialog({
  open,
  mode,
  focus,
  currentBranch,
  branchOptions,
  branchOptionsKey,
  branchIndex,
  onBranchChange,
  branchStrategyOptions,
  branchStrategyIndex,
  onBranchStrategyChange,
  branchName,
  branchNameRef,
  onBranchNameInput,
  theme,
}: BranchDialogProps) {
  if (!open) return null

  return (
    <box
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
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
            <select
              key={branchOptionsKey}
              style={{ width: "100%", height: "100%", textColor: theme.colors.selectText }}
              options={branchOptions}
              selectedIndex={branchIndex}
              showDescription={true}
              focused={focus === "branch-dialog-list"}
              selectedBackgroundColor={theme.colors.selectSelectedBackground}
              selectedTextColor={theme.colors.selectSelectedText}
              focusedTextColor={theme.colors.selectFocusedText}
              onChange={onBranchChange}
            />
          </>
        ) : mode === "confirm" ? (
          <>
            <text fg={theme.colors.subtleText}>what should happen to your working changes? | enter to continue | esc to go back</text>
            <select
              key={`${branchOptionsKey}-strategy`}
              style={{ width: "100%", height: "100%", textColor: theme.colors.selectText }}
              options={branchStrategyOptions}
              selectedIndex={branchStrategyIndex}
              showDescription={true}
              focused={focus === "branch-dialog-list"}
              selectedBackgroundColor={theme.colors.selectSelectedBackground}
              selectedTextColor={theme.colors.selectSelectedText}
              focusedTextColor={theme.colors.selectFocusedText}
              onChange={onBranchStrategyChange}
            />
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
