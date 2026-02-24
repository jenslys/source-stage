import type { Dispatch, SetStateAction } from "react"

import type { BranchDialogMode, CommitHistoryMode, FocusTarget, TopAction } from "../../ui/types"

export type RendererClipboard = {
  destroy: () => void
  getSelection?: () => { getSelectedText: () => string } | null
  copyToClipboardOSC52?: (text: string) => boolean
}

export type UseGitTuiKeyboardParams = {
  renderer: RendererClipboard
  commitDialogOpen: boolean
  syncDialogOpen: boolean
  mergeConflictDialogOpen: boolean
  branchDialogOpen: boolean
  branchDialogMode: BranchDialogMode
  historyDialogOpen: boolean
  historyDialogMode: CommitHistoryMode
  shortcutsDialogOpen: boolean
  setCommitDialogOpen: Dispatch<SetStateAction<boolean>>
  setFocus: Dispatch<SetStateAction<FocusTarget>>
  focus: FocusTarget
  fileCount: number
  moveToPreviousFile: () => void
  moveToNextFile: () => void
  openBranchDialog: () => void
  closeBranchDialog: () => void
  closeSyncDialog: () => void
  closeMergeConflictDialog: () => void
  showBranchDialogList: () => void
  submitBranchSelection: () => Promise<void>
  submitBranchAction: () => Promise<void>
  submitBranchStrategy: () => Promise<void>
  moveBranchSelectionUp: () => void
  moveBranchSelectionDown: () => void
  moveBranchActionUp: () => void
  moveBranchActionDown: () => void
  moveSyncSelectionUp: () => void
  moveSyncSelectionDown: () => void
  moveBranchStrategyUp: () => void
  moveBranchStrategyDown: () => void
  openHistoryDialog: () => Promise<void>
  closeHistoryDialog: () => void
  backToHistoryCommitList: () => void
  submitHistoryCommitSelection: () => Promise<void>
  submitHistoryAction: () => Promise<void>
  submitSyncAction: () => Promise<void>
  submitMergeConflictAction: () => Promise<void>
  openSelectedMergeConflictFileInEditor: () => Promise<void>
  moveCommitSelectionUp: () => void
  moveCommitSelectionDown: () => void
  moveHistoryFileSelectionUp: () => void
  moveHistoryFileSelectionDown: () => void
  moveHistoryActionUp: () => void
  moveHistoryActionDown: () => void
  moveMergeConflictFileUp: () => void
  moveMergeConflictFileDown: () => void
  moveMergeConflictActionUp: () => void
  moveMergeConflictActionDown: () => void
  commitChanges: () => Promise<void>
  createBranchAndCheckout: () => Promise<void>
  openCommitDialog: () => void
  openSelectedFileInEditor: () => Promise<void>
  openShortcutsDialog: () => void
  closeShortcutsDialog: () => void
  runTopAction: (action: TopAction) => Promise<void>
  toggleSelectedFileInCommit: () => void
}

export type KeyboardFlags = {
  hasNonShiftModifier: boolean
  isPlainShortcutKey: boolean
  isMetaCopy: boolean
  isHelpKey: boolean
  isSpaceKey: boolean
  isEnter: boolean
  isDialogOpen: boolean
}
