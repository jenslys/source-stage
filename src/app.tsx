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
          theme={theme}
        />
      ) : null}

      {activeScreen === "branch" ? (
        <BranchDialog
          open={true}
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
          currentBranch={controller.currentBranch}
          commitOptions={controller.commitOptions}
          commitIndex={controller.commitIndex}
          onCommitChange={controller.onCommitIndexChange}
          actionOptions={controller.actionOptions}
          actionIndex={controller.actionIndex}
          onActionChange={controller.onActionIndexChange}
          selectedCommitTitle={controller.selectedCommitTitle}
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
