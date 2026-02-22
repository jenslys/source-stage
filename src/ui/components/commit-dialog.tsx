import type { InputRenderable, TextareaRenderable } from "@opentui/core"
import type { RefObject } from "react"

import type { FocusTarget } from "../types"

type CommitDialogProps = {
  open: boolean
  focus: FocusTarget
  summary: string
  descriptionRenderKey: number
  summaryRef: RefObject<InputRenderable | null>
  descriptionRef: RefObject<TextareaRenderable | null>
  onSummaryInput: (value: string) => void
}

export function CommitDialog({
  open,
  focus,
  summary,
  descriptionRenderKey,
  summaryRef,
  descriptionRef,
  onSummaryInput,
}: CommitDialogProps) {
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
        paddingTop: 4,
        paddingBottom: 3,
        gap: 1,
      }}
    >
      <text fg="#f5f5f5">commit changes</text>
      <text fg="#525252">enter to commit | esc to cancel</text>
      <box style={{ width: "100%", height: 3, flexDirection: "column", marginTop: 1 }}>
        <input
          ref={summaryRef}
          value={summary}
          onInput={onSummaryInput}
          placeholder="summary (required)"
          focused={focus === "commit-summary"}
          backgroundColor="#000000"
          textColor="#f3f4f6"
          focusedBackgroundColor="#000000"
          focusedTextColor="#f9fafb"
        />
      </box>
      <box style={{ width: "100%", flexGrow: 1 }}>
        <textarea
          key={descriptionRenderKey}
          ref={descriptionRef}
          initialValue=""
          placeholder="description (optional)"
          focused={focus === "commit-description"}
          backgroundColor="#000000"
          textColor="#d1d5db"
          focusedBackgroundColor="#000000"
          focusedTextColor="#f3f4f6"
        />
      </box>
    </box>
  )
}
