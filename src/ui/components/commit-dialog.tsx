import type { InputRenderable, TextareaRenderable } from "@opentui/core"
import type { RefObject } from "react"

import type { UiTheme } from "../theme"
import type { FocusTarget } from "../types"

type CommitDialogProps = {
  open: boolean
  focus: FocusTarget
  summary: string
  descriptionRenderKey: number
  summaryRef: RefObject<InputRenderable | null>
  descriptionRef: RefObject<TextareaRenderable | null>
  onSummaryInput: (value: string) => void
  theme: UiTheme
}

export function CommitDialog({
  open,
  focus,
  summary,
  descriptionRenderKey,
  summaryRef,
  descriptionRef,
  onSummaryInput,
  theme,
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
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 4,
        paddingBottom: 3,
        gap: 1,
      }}
    >
      <text fg={theme.colors.title}>commit changes</text>
      <text fg={theme.colors.subtleText}>enter to commit | esc to cancel</text>
      <box style={{ width: "100%", height: 3, flexDirection: "column", marginTop: 1 }}>
        <input
          ref={summaryRef}
          value={summary}
          onInput={onSummaryInput}
          placeholder="summary (required)"
          focused={focus === "commit-summary"}
          textColor={theme.colors.inputText}
          focusedTextColor={theme.colors.inputFocusedText}
        />
      </box>
      <box style={{ width: "100%", flexGrow: 1 }}>
        <textarea
          key={descriptionRenderKey}
          ref={descriptionRef}
          initialValue=""
          placeholder="description (optional)"
          focused={focus === "commit-description"}
          textColor={theme.colors.secondaryInputText}
          focusedTextColor={theme.colors.inputText}
        />
      </box>
    </box>
  )
}
