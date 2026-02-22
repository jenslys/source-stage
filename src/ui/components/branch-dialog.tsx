import type { InputRenderable } from "@opentui/core"
import type { RefObject } from "react"

import type { FocusTarget } from "../types"

type BranchDialogProps = {
  open: boolean
  focus: FocusTarget
  branchName: string
  branchNameRef: RefObject<InputRenderable | null>
  onBranchNameInput: (value: string) => void
}

export function BranchDialog({ open, focus, branchName, branchNameRef, onBranchNameInput }: BranchDialogProps) {
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
      }}
    >
      <box style={{ width: "100%", maxWidth: 72, gap: 1 }}>
        <text fg="#f5f5f5">create branch</text>
        <text fg="#525252">enter to create and checkout | esc to cancel</text>
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
      </box>
    </box>
  )
}
