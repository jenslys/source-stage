import { COMMIT_FOCUS_ORDER, HISTORY_LIST_FOCUS_ORDER, MAIN_FOCUS_ORDER } from "../../ui/types"
import type { KeyboardFlags, UseGitTuiKeyboardParams } from "./types"

type KeyboardEventLike = {
  name?: string
  shift: boolean
  preventDefault: () => void
  stopPropagation: () => void
}

export function handleDialogKeys({
  key,
  flags,
  params,
}: {
  key: KeyboardEventLike
  flags: KeyboardFlags
  params: UseGitTuiKeyboardParams
}): boolean {
  const {
    renderer,
    commitDialogOpen,
    syncDialogOpen,
    discardDialogOpen,
    mergeConflictDialogOpen,
    branchDialogOpen,
    branchDialogMode,
    historyDialogOpen,
    historyDialogMode,
    shortcutsDialogOpen,
    closeShortcutsDialog,
    closeSyncDialog,
    closeDiscardDialog,
    closeMergeConflictDialog,
    openShortcutsDialog,
    focus,
    mergeConflictFileCount,
    setFocus,
    submitHistoryAction,
    submitSyncAction,
    submitDiscardAction,
    submitMergeConflictAction,
    openSelectedMergeConflictFileInEditor,
    submitHistoryCommitSelection,
    moveCommitSelectionUp,
    moveCommitSelectionDown,
    moveHistoryActionUp,
    moveHistoryActionDown,
    moveHistoryFileSelectionUp,
    moveHistoryFileSelectionDown,
    createBranchAndCheckout,
    submitBranchAction,
    submitBranchStrategy,
    submitBranchSelection,
    moveBranchActionUp,
    moveBranchActionDown,
    moveBranchStrategyUp,
    moveBranchStrategyDown,
    moveBranchSelectionUp,
    moveBranchSelectionDown,
    moveSyncSelectionUp,
    moveSyncSelectionDown,
    moveMergeConflictFileUp,
    moveMergeConflictFileDown,
    moveDiscardSelectionUp,
    moveDiscardSelectionDown,
    moveMergeConflictActionUp,
    moveMergeConflictActionDown,
    commitChanges,
    backToHistoryCommitList,
    closeHistoryDialog,
    closeBranchDialog,
    showBranchDialogList,
    setCommitDialogOpen,
  } = params

  if (flags.isMetaCopy) {
    const selectedText = renderer.getSelection?.()?.getSelectedText?.()
    if (selectedText && selectedText.length > 0) {
      renderer.copyToClipboardOSC52?.(selectedText)
      key.preventDefault()
      key.stopPropagation()
      return true
    }
  }

  if (
    !commitDialogOpen &&
    !syncDialogOpen &&
    !discardDialogOpen &&
    !mergeConflictDialogOpen &&
    !branchDialogOpen &&
    !historyDialogOpen &&
    flags.isHelpKey
  ) {
    key.preventDefault()
    key.stopPropagation()
    if (shortcutsDialogOpen) {
      closeShortcutsDialog()
    } else {
      openShortcutsDialog()
    }
    return true
  }

  if (shortcutsDialogOpen) {
    if (key.name === "escape") {
      key.preventDefault()
      key.stopPropagation()
      closeShortcutsDialog()
    }
    return true
  }

  if (syncDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    void submitSyncAction()
    return true
  }

  if (syncDialogOpen && focus === "sync-dialog-list" && key.name === "up") {
    key.preventDefault()
    key.stopPropagation()
    moveSyncSelectionUp()
    return true
  }

  if (syncDialogOpen && focus === "sync-dialog-list" && key.name === "down") {
    key.preventDefault()
    key.stopPropagation()
    moveSyncSelectionDown()
    return true
  }

  if (discardDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    void submitDiscardAction()
    return true
  }

  if (discardDialogOpen && focus === "discard-dialog-list" && key.name === "up") {
    key.preventDefault()
    key.stopPropagation()
    moveDiscardSelectionUp()
    return true
  }

  if (discardDialogOpen && focus === "discard-dialog-list" && key.name === "down") {
    key.preventDefault()
    key.stopPropagation()
    moveDiscardSelectionDown()
    return true
  }

  if (mergeConflictDialogOpen && flags.isEnter && focus === "merge-conflict-files") {
    key.preventDefault()
    key.stopPropagation()
    if (mergeConflictFileCount === 0) {
      setFocus("merge-conflict-actions")
      return true
    }
    void openSelectedMergeConflictFileInEditor()
    return true
  }

  if (mergeConflictDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    void submitMergeConflictAction()
    return true
  }

  if (mergeConflictDialogOpen && focus === "merge-conflict-files" && key.name === "up") {
    key.preventDefault()
    key.stopPropagation()
    moveMergeConflictFileUp()
    return true
  }

  if (mergeConflictDialogOpen && focus === "merge-conflict-files" && key.name === "down") {
    key.preventDefault()
    key.stopPropagation()
    moveMergeConflictFileDown()
    return true
  }

  if (mergeConflictDialogOpen && focus === "merge-conflict-actions" && key.name === "up") {
    key.preventDefault()
    key.stopPropagation()
    moveMergeConflictActionUp()
    return true
  }

  if (mergeConflictDialogOpen && focus === "merge-conflict-actions" && key.name === "down") {
    key.preventDefault()
    key.stopPropagation()
    moveMergeConflictActionDown()
    return true
  }

  if (mergeConflictDialogOpen && key.name === "left") {
    key.preventDefault()
    key.stopPropagation()
    setFocus("merge-conflict-files")
    return true
  }

  if (mergeConflictDialogOpen && key.name === "right") {
    key.preventDefault()
    key.stopPropagation()
    setFocus("merge-conflict-actions")
    return true
  }

  if (historyDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    if (historyDialogMode === "action") {
      void submitHistoryAction()
    } else {
      void submitHistoryCommitSelection()
    }
    return true
  }

  if (historyDialogOpen) {
    if (focus === "history-commits" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveCommitSelectionUp()
      return true
    }
    if (focus === "history-commits" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveCommitSelectionDown()
      return true
    }
    if (focus === "history-actions" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryActionUp()
      return true
    }
    if (focus === "history-actions" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryActionDown()
      return true
    }
    if (focus === "history-files" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryFileSelectionUp()
      return true
    }
    if (focus === "history-files" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryFileSelectionDown()
      return true
    }

    if (historyDialogMode === "list" && key.name === "left" && focus === "history-files") {
      key.preventDefault()
      key.stopPropagation()
      setFocus("history-commits")
      return true
    }

    if (historyDialogMode === "list" && key.name === "right" && focus === "history-commits") {
      key.preventDefault()
      key.stopPropagation()
      setFocus("history-files")
      return true
    }
  }

  if (branchDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    if (branchDialogMode === "create") {
      void createBranchAndCheckout()
    } else if (branchDialogMode === "confirm") {
      void submitBranchStrategy()
    } else if (branchDialogMode === "action") {
      void submitBranchAction()
    } else {
      void submitBranchSelection()
    }
    return true
  }

  if (branchDialogOpen && focus === "branch-dialog-list" && key.name === "up") {
    key.preventDefault()
    key.stopPropagation()
    if (branchDialogMode === "confirm") {
      moveBranchStrategyUp()
    } else if (branchDialogMode === "action") {
      moveBranchActionUp()
    } else {
      moveBranchSelectionUp()
    }
    return true
  }

  if (branchDialogOpen && focus === "branch-dialog-list" && key.name === "down") {
    key.preventDefault()
    key.stopPropagation()
    if (branchDialogMode === "confirm") {
      moveBranchStrategyDown()
    } else if (branchDialogMode === "action") {
      moveBranchActionDown()
    } else {
      moveBranchSelectionDown()
    }
    return true
  }

  if (commitDialogOpen && flags.isEnter) {
    key.preventDefault()
    key.stopPropagation()
    void commitChanges()
    return true
  }

  if (key.name === "escape") {
    if (mergeConflictDialogOpen) {
      closeMergeConflictDialog()
      return true
    }

    if (syncDialogOpen) {
      closeSyncDialog()
      return true
    }

    if (discardDialogOpen) {
      closeDiscardDialog()
      return true
    }

    if (historyDialogOpen) {
      if (historyDialogMode === "action") {
        backToHistoryCommitList()
      } else {
        closeHistoryDialog()
      }
      return true
    }

    if (branchDialogOpen) {
      if (branchDialogMode === "select") {
        closeBranchDialog()
      } else {
        showBranchDialogList()
      }
      return true
    }

    if (commitDialogOpen) {
      setCommitDialogOpen(false)
      setFocus("files")
      return true
    }

    renderer.destroy()
    return true
  }

  if (key.name === "tab") {
    key.preventDefault()
    key.stopPropagation()
    if (mergeConflictDialogOpen) {
      setFocus((current) =>
        current === "merge-conflict-actions" ? "merge-conflict-files" : "merge-conflict-actions",
      )
      return true
    }

    if (syncDialogOpen) {
      setFocus("sync-dialog-list")
      return true
    }

    if (discardDialogOpen) {
      setFocus("discard-dialog-list")
      return true
    }

    if (branchDialogOpen) {
      setFocus(branchDialogMode === "create" ? "branch-create" : "branch-dialog-list")
      return true
    }

    if (historyDialogOpen) {
      if (historyDialogMode === "action") {
        setFocus("history-actions")
        return true
      }

      setFocus((current) => {
        const currentIndex = HISTORY_LIST_FOCUS_ORDER.findIndex((item) => item === current)
        if (currentIndex < 0) return HISTORY_LIST_FOCUS_ORDER[0] ?? "history-commits"
        const nextIndex = key.shift
          ? (currentIndex - 1 + HISTORY_LIST_FOCUS_ORDER.length) % HISTORY_LIST_FOCUS_ORDER.length
          : (currentIndex + 1) % HISTORY_LIST_FOCUS_ORDER.length
        return HISTORY_LIST_FOCUS_ORDER[nextIndex] ?? "history-commits"
      })
      return true
    }

    const order = commitDialogOpen ? COMMIT_FOCUS_ORDER : MAIN_FOCUS_ORDER
    setFocus((current) => {
      const currentIndex = order.findIndex((item) => item === current)
      if (currentIndex < 0) return order[0] ?? "files"
      const nextIndex = key.shift
        ? (currentIndex - 1 + order.length) % order.length
        : (currentIndex + 1) % order.length
      return order[nextIndex] ?? "files"
    })
    return true
  }

  return false
}
