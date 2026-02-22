import { useRenderer, useTerminalDimensions } from "@opentui/react"

import { useGitTuiController } from "./hooks/use-git-tui-controller"
import { CommitDialog } from "./ui/components/commit-dialog"
import { DiffWorkspace } from "./ui/components/diff-workspace"
import { FooterBar } from "./ui/components/footer-bar"
import { TopBar } from "./ui/components/top-bar"

export function App() {
  const renderer = useRenderer()
  const { width: terminalWidth = 0 } = useTerminalDimensions()
  const controller = useGitTuiController(renderer)

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: "#000000",
      }}
    >
      <TopBar
        branchOptions={controller.branchOptions}
        branchOptionsKey={controller.branchOptionsKey}
        branchIndex={controller.branchIndex}
        focus={controller.focus}
        onBranchChange={controller.onBranchChange}
        onBranchSelect={controller.onBranchSelect}
      />

      <DiffWorkspace
        fileOptions={controller.fileOptions}
        fileOptionsKey={controller.fileOptionsKey}
        fileIndex={controller.fileIndex}
        selectedFilePath={controller.selectedFilePath}
        focus={controller.focus}
        diffText={controller.diffText}
        diffFiletype={controller.diffFiletype}
        onFileSelect={controller.onFileSelect}
      />

      <FooterBar
        statusMessage={controller.statusMessage}
        topStatus={controller.topStatus}
        terminalWidth={terminalWidth}
        fatalError={controller.fatalError}
        isBusy={controller.isBusy}
      />

      <CommitDialog
        open={controller.commitDialogOpen}
        focus={controller.focus}
        summary={controller.summary}
        descriptionRenderKey={controller.descriptionRenderKey}
        summaryRef={controller.summaryRef}
        descriptionRef={controller.descriptionRef}
        onSummaryInput={controller.onSummaryInput}
      />
    </box>
  )
}
