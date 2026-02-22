import type { InputRenderable, SelectOption } from "@opentui/core"
import type { RefObject } from "react"

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
        backgroundColor: "#000000",
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <box style={{ width: "100%", maxWidth: 88, gap: 1, flexDirection: "column", flexGrow: 1 }}>
        <text fg="#f5f5f5">change branch</text>
        <text fg="#525252">current: {currentBranch}</text>
        {mode === "select" ? (
          <>
            <text fg="#525252">enter to checkout | select & enter to create branch | esc to close</text>
            <select
              key={branchOptionsKey}
              style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
              options={branchOptions}
              selectedIndex={branchIndex}
              showDescription={true}
              focused={focus === "branch-dialog-list"}
              selectedBackgroundColor="#111111"
              selectedTextColor="#ffffff"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f3f4f6"
              onChange={onBranchChange}
            />
          </>
        ) : mode === "confirm" ? (
          <>
            <text fg="#525252">what should happen to your working changes? | enter to continue | esc to go back</text>
            <select
              key={`${branchOptionsKey}-strategy`}
              style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
              options={branchStrategyOptions}
              selectedIndex={branchStrategyIndex}
              showDescription={true}
              focused={focus === "branch-dialog-list"}
              selectedBackgroundColor="#111111"
              selectedTextColor="#ffffff"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f3f4f6"
              onChange={onBranchStrategyChange}
            />
          </>
        ) : (
          <>
            <text fg="#525252">enter to create and checkout | esc to go back</text>
            <input
              ref={branchNameRef}
              value={branchName}
              onInput={onBranchNameInput}
              placeholder="new branch name"
              focused={focus === "branch-create"}
              backgroundColor="#000000"
              textColor="#f3f4f6"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f9fafb"
            />
          </>
        )}
      </box>
    </box>
  )
}
