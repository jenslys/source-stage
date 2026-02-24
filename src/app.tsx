import { useRenderer, useTerminalDimensions } from "@opentui/react"

import type { StageConfig } from "./config"
import { BranchDialog } from "./ui/components/branch-dialog"
import { CommitHistoryDialog } from "./ui/components/commit-history-dialog"
import { useGitTuiController } from "./hooks/use-git-tui-controller"
import { CommitDialog } from "./ui/components/commit-dialog"
import { DiffWorkspace } from "./ui/components/diff-workspace"
import { FooterBar } from "./ui/components/footer-bar"
import { ShortcutsDialog } from "./ui/components/shortcuts-dialog"
import { TopBar } from "./ui/components/top-bar"
import { resolveUiTheme } from "./ui/theme"

type AppProps = {
  config: StageConfig
}

export function App({ config }: AppProps) {
  const renderer = useRenderer()
  const { width: terminalWidth = 0, height: terminalHeight = 0 } = useTerminalDimensions()
  const theme = resolveUiTheme(config.ui.theme)
  const controller = useGitTuiController(renderer, config)
  const activeScreen = controller.branchDialogOpen
    ? "branch"
    : controller.commitDialogOpen
      ? "commit"
      : controller.historyDialogOpen
        ? "history"
        : controller.shortcutsDialogOpen
          ? "shortcuts"
          : "main"

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
      }}
    >
      <TopBar
        currentBranch={controller.currentBranch}
        tracking={controller.tracking}
        theme={theme}
      />

      {activeScreen === "main" ? (
        <DiffWorkspace
          fileRows={controller.fileRows}
          fileIndex={controller.fileIndex}
          selectedFilePath={controller.selectedFilePath}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          diffText={controller.diffText}
          diffMessage={controller.diffMessage}
          diffFiletype={controller.diffFiletype}
          diffView={config.ui.diffView}
          onFileClick={(index) => {
            controller.focusFiles()
            controller.setMainFileSelection(index)
          }}
          onFileScroll={(direction) => {
            controller.focusFiles()
            if (direction === "up") {
              controller.moveToPreviousMainFile()
            } else {
              controller.moveToNextMainFile()
            }
          }}
          theme={theme}
        />
      ) : null}

      {activeScreen === "branch" ? (
        <BranchDialog
          open={true}
          mode={controller.branchDialogMode}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          currentBranch={controller.currentBranch}
          branchOptions={controller.branchOptions}
          branchIndex={controller.branchIndex}
          branchStrategyOptions={controller.branchStrategyOptions}
          branchStrategyIndex={controller.branchStrategyIndex}
          branchName={controller.newBranchName}
          branchNameRef={controller.branchNameRef}
          onBranchNameInput={controller.onBranchNameInput}
          onBranchClick={(index) => {
            controller.focusBranchDialogList()
            controller.setBranchSelection(index)
          }}
          onBranchStrategyClick={(index) => {
            controller.focusBranchDialogList()
            controller.setBranchStrategySelection(index)
          }}
          onBranchScroll={(direction) => {
            controller.focusBranchDialogList()
            if (direction === "up") {
              controller.moveBranchSelectionUp()
            } else {
              controller.moveBranchSelectionDown()
            }
          }}
          onBranchStrategyScroll={(direction) => {
            controller.focusBranchDialogList()
            if (direction === "up") {
              controller.moveBranchStrategyUp()
            } else {
              controller.moveBranchStrategyDown()
            }
          }}
          theme={theme}
        />
      ) : null}

      {activeScreen === "commit" ? (
        <CommitDialog
          open={true}
          focus={controller.focus}
          summary={controller.summary}
          descriptionRenderKey={controller.descriptionRenderKey}
          summaryRef={controller.summaryRef}
          descriptionRef={controller.descriptionRef}
          onSummaryInput={controller.onSummaryInput}
          theme={theme}
        />
      ) : null}

      {activeScreen === "history" ? (
        <CommitHistoryDialog
          open={true}
          mode={controller.historyMode}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          currentBranch={controller.currentBranch}
          commitOptions={controller.commitOptions}
          commitIndex={controller.commitIndex}
          actionOptions={controller.actionOptions}
          actionIndex={controller.actionIndex}
          fileOptions={controller.historyFileOptions}
          fileIndex={controller.historyFileIndex}
          selectedCommitTitle={controller.selectedCommitTitle}
          selectedCommitPreviewTitle={controller.selectedCommitPreviewTitle}
          selectedFilePath={controller.selectedHistoryFilePath}
          diffText={controller.historyDiffText}
          diffMessage={controller.historyDiffMessage}
          diffFiletype={controller.historyDiffFiletype}
          diffView={config.ui.diffView}
          onCommitClick={(index) => {
            controller.focusHistoryCommits()
            controller.setCommitSelection(index)
          }}
          onFileClick={(index) => {
            controller.focusHistoryFiles()
            controller.setHistoryFileSelection(index)
          }}
          onActionClick={(index) => {
            controller.focusHistoryActions()
            controller.setHistoryActionSelection(index)
          }}
          onCommitScroll={(direction) => {
            controller.focusHistoryCommits()
            if (direction === "up") {
              controller.moveCommitSelectionUp()
            } else {
              controller.moveCommitSelectionDown()
            }
          }}
          onFileScroll={(direction) => {
            controller.focusHistoryFiles()
            if (direction === "up") {
              controller.moveHistoryFileSelectionUp()
            } else {
              controller.moveHistoryFileSelectionDown()
            }
          }}
          onActionScroll={(direction) => {
            controller.focusHistoryActions()
            if (direction === "up") {
              controller.moveHistoryActionUp()
            } else {
              controller.moveHistoryActionDown()
            }
          }}
          theme={theme}
        />
      ) : null}

      {activeScreen === "shortcuts" ? (
        <ShortcutsDialog open={true} aiCommitEnabled={config.ai.enabled} theme={theme} />
      ) : null}

      <FooterBar
        statusMessage={controller.statusMessage}
        showShortcutsHint={config.ui.showShortcutsHint}
        terminalWidth={terminalWidth}
        fatalError={controller.fatalError}
        isBusy={controller.isBusy}
        theme={theme}
      />
    </box>
  )
}
