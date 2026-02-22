import type { SelectOption } from "@opentui/core"

import { DIFF_SYNTAX_STYLE } from "../diff-style"
import type { FocusTarget } from "../types"

type DiffWorkspaceProps = {
  fileOptions: SelectOption[]
  fileOptionsKey: string
  fileIndex: number
  selectedFilePath: string | null
  focus: FocusTarget
  diffText: string
  diffFiletype: string | undefined
  onFileSelect: (index: number) => void
}

export function DiffWorkspace({
  fileOptions,
  fileOptionsKey,
  fileIndex,
  selectedFilePath,
  focus,
  diffText,
  diffFiletype,
  onFileSelect,
}: DiffWorkspaceProps) {
  return (
    <box style={{ flexDirection: "row", flexGrow: 1, gap: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ width: 42, flexDirection: "column" }}>
        <text fg="#737373">changes ({fileOptions.length})</text>
        <select
          key={fileOptionsKey}
          style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
          options={fileOptions}
          selectedIndex={fileIndex}
          focused={focus === "files"}
          selectedBackgroundColor="#101010"
          selectedTextColor="#f9fafb"
          focusedBackgroundColor="#000000"
          focusedTextColor="#f3f4f6"
          onChange={onFileSelect}
          onSelect={onFileSelect}
          showDescription={false}
          wrapSelection={true}
        />
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text fg="#737373">{selectedFilePath ?? "no file selected"}</text>
        <diff
          diff={diffText}
          view="split"
          filetype={diffFiletype}
          syntaxStyle={DIFF_SYNTAX_STYLE}
          showLineNumbers={true}
          wrapMode="none"
          lineNumberFg="#525252"
          lineNumberBg="#000000"
          contextBg="#000000"
          contextContentBg="#000000"
          addedBg="#06180c"
          removedBg="#220909"
          addedContentBg="#06180c"
          removedContentBg="#220909"
          addedLineNumberBg="#0a2212"
          removedLineNumberBg="#2c1010"
          fg="#e5e7eb"
          style={{ width: "100%", height: "100%" }}
        />
      </box>
    </box>
  )
}
