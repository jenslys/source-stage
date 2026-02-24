import { useRenderer, useTerminalDimensions } from "@opentui/react"

import type { StageConfig } from "./config"
import { BranchDialog } from "./ui/components/branch-dialog"
import { CommitHistoryDialog } from "./ui/components/commit-history-dialog"
import { useGitTuiController } from "./hooks/use-git-tui-controller"
import { CommitDialog } from "./ui/components/commit-dialog"
import { DiffWorkspace } from "./ui/components/diff-workspace"
import { DiscardDialog } from "./ui/components/discard-dialog"
import { FooterBar } from "./ui/components/footer-bar"
import { MergeConflictDialog } from "./ui/components/merge-conflict-dialog"
import { ShortcutsDialog } from "./ui/components/shortcuts-dialog"
import { SyncDialog } from "./ui/components/sync-dialog"
import { TopBar } from "./ui/components/top-bar"
import { resolveUiTheme } from "./ui/theme"

type AppProps = {
  config: StageConfig
}

type ActiveScreen =
  | "main"
  | "branch"
  | "commit"
  | "history"
  | "shortcuts"
  | "sync"
  | "discard"
  | "merge-conflict"

export function App({ config }: AppProps) {
  const renderer = useRenderer()
  const { width: terminalWidth = 0, height: terminalHeight = 0 } = useTerminalDimensions()
  const theme = resolveUiTheme(config.ui.theme)
  const controller = useGitTuiController(renderer, config)
  const activeScreen: ActiveScreen = controller.mergeConflictDialogOpen
    ? "merge-conflict"
    : controller.discardDialogOpen
      ? "discard"
      : controller.syncDialogOpen
        ? "sync"
        : controller.branchDialogOpen
          ? "branch"
          : controller.commitDialogOpen
            ? "commit"
            : controller.historyDialogOpen
              ? "history"
              : controller.shortcutsDialogOpen
                ? "shortcuts"
                : "main"
  const footerHint = resolveFooterHint({
    activeScreen,
    branchDialogMode: controller.branchDialogMode,
    historyMode: controller.historyMode,
  })

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
          hasSnapshot={controller.hasSnapshot}
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
          selectedBranchForAction={controller.selectedBranchForAction}
          branchActionOptions={controller.branchActionOptions}
          branchActionIndex={controller.branchActionIndex}
          branchStrategyOptions={controller.branchStrategyOptions}
          branchStrategyIndex={controller.branchStrategyIndex}
          branchName={controller.newBranchName}
          branchNameRef={controller.branchNameRef}
          onBranchNameInput={controller.onBranchNameInput}
          onBranchClick={(index) => {
            controller.focusBranchDialogList()
            controller.setBranchSelection(index)
          }}
          onBranchActionClick={(index) => {
            controller.focusBranchDialogList()
            controller.setBranchActionSelection(index)
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
          onBranchActionScroll={(direction) => {
            controller.focusBranchDialogList()
            if (direction === "up") {
              controller.moveBranchActionUp()
            } else {
              controller.moveBranchActionDown()
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

      {activeScreen === "sync" ? (
        <SyncDialog
          open={true}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          options={controller.syncOptions}
          optionIndex={controller.syncOptionIndex}
          details={controller.syncDetails}
          onOptionClick={(index) => {
            controller.setSyncSelection(index)
          }}
          onOptionScroll={(direction) => {
            if (direction === "up") {
              controller.moveSyncSelectionUp()
            } else {
              controller.moveSyncSelectionDown()
            }
          }}
          theme={theme}
        />
      ) : null}

      {activeScreen === "discard" ? (
        <DiscardDialog
          open={true}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          path={controller.discardPath ?? ""}
          options={controller.discardOptions}
          optionIndex={controller.discardOptionIndex}
          onOptionClick={(index) => {
            controller.setDiscardSelection(index)
          }}
          onOptionScroll={(direction) => {
            if (direction === "up") {
              controller.moveDiscardSelectionUp()
            } else {
              controller.moveDiscardSelectionDown()
            }
          }}
          theme={theme}
        />
      ) : null}

      {activeScreen === "merge-conflict" ? (
        <MergeConflictDialog
          open={true}
          focus={controller.focus}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          currentBranch={controller.currentBranch}
          details={controller.mergeConflictDetails}
          conflictFileOptions={controller.mergeConflictFileOptions}
          conflictFileIndex={controller.mergeConflictFileIndex}
          actionOptions={controller.mergeConflictActionOptions}
          actionIndex={controller.mergeConflictActionIndex}
          onConflictFileClick={(index) => {
            controller.setMergeConflictFileSelection(index)
          }}
          onConflictActionClick={(index) => {
            controller.setMergeConflictActionSelection(index)
          }}
          onConflictFileScroll={(direction) => {
            if (direction === "up") {
              controller.moveMergeConflictFileUp()
            } else {
              controller.moveMergeConflictFileDown()
            }
          }}
          onConflictActionScroll={(direction) => {
            if (direction === "up") {
              controller.moveMergeConflictActionUp()
            } else {
              controller.moveMergeConflictActionDown()
            }
          }}
          theme={theme}
        />
      ) : null}

      <FooterBar
        statusMessage={controller.statusMessage}
        showShortcutsHint={config.ui.showShortcutsHint}
        hintText={footerHint}
        terminalWidth={terminalWidth}
        fatalError={controller.fatalError}
        isBusy={controller.isBusy}
        theme={theme}
      />
    </box>
  )
}

function resolveFooterHint({
  activeScreen,
  branchDialogMode,
  historyMode,
}: {
  activeScreen: ActiveScreen
  branchDialogMode: "select" | "action" | "confirm" | "create"
  historyMode: "list" | "action"
}): string {
  if (activeScreen === "main") return "[?] shortcuts"
  if (activeScreen === "commit") return "enter commit  esc cancel"
  if (activeScreen === "shortcuts") return "esc close"
  if (activeScreen === "sync") return "enter choose  esc back"
  if (activeScreen === "discard") return "enter choose  esc back"
  if (activeScreen === "merge-conflict") return "enter open or finish  tab next panel  esc back"
  if (activeScreen === "history") {
    if (historyMode === "action") return "enter choose  esc back"
    return "tab next panel  enter actions  esc close"
  }

  if (branchDialogMode === "confirm") return "enter choose  esc back"
  if (branchDialogMode === "action") return "enter choose  esc back"
  if (branchDialogMode === "create") return "enter create  esc back"
  return "enter choose branch  esc back"
}
