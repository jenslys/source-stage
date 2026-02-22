import { useRenderer, useTerminalDimensions } from "@opentui/react"

import { BranchDialog } from "./ui/components/branch-dialog"
import { useGitTuiController } from "./hooks/use-git-tui-controller"
import { CommitDialog } from "./ui/components/commit-dialog"
import { DiffWorkspace } from "./ui/components/diff-workspace"
import { FooterBar } from "./ui/components/footer-bar"
import { TopBar } from "./ui/components/top-bar"

export function App() {
  const renderer = useRenderer()
  const { width: terminalWidth = 0, height: terminalHeight = 0 } = useTerminalDimensions()
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
        currentBranch={controller.currentBranch}
      />

      <DiffWorkspace
        fileRows={controller.fileRows}
        fileIndex={controller.fileIndex}
        selectedFilePath={controller.selectedFilePath}
        focus={controller.focus}
        terminalHeight={terminalHeight}
        diffText={controller.diffText}
        diffMessage={controller.diffMessage}
        diffFiletype={controller.diffFiletype}
      />

      <FooterBar
        statusMessage={controller.statusMessage}
        topStatus={controller.topStatus}
        terminalWidth={terminalWidth}
        fatalError={controller.fatalError}
        isBusy={controller.isBusy}
      />

      <BranchDialog
        open={controller.branchDialogOpen}
        mode={controller.branchDialogMode}
        focus={controller.focus}
        currentBranch={controller.currentBranch}
        branchOptions={controller.branchOptions}
        branchOptionsKey={controller.branchOptionsKey}
        branchIndex={controller.branchIndex}
        onBranchChange={controller.onBranchDialogChange}
        branchStrategyOptions={controller.branchStrategyOptions}
        branchStrategyIndex={controller.branchStrategyIndex}
        onBranchStrategyChange={controller.onBranchStrategyChange}
        branchName={controller.newBranchName}
        branchNameRef={controller.branchNameRef}
        onBranchNameInput={controller.onBranchNameInput}
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
