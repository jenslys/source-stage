import { useKeyboard } from "@opentui/react"
import type { Dispatch, SetStateAction } from "react"

import { COMMIT_FOCUS_ORDER, MAIN_FOCUS_ORDER, type FocusTarget, type TopAction } from "../ui/types"

type UseGitTuiKeyboardParams = {
  renderer: {
    destroy: () => void
    getSelection?: () => { getSelectedText: () => string } | null
    copyToClipboardOSC52?: (text: string) => boolean
  }
  commitDialogOpen: boolean
  branchDialogOpen: boolean
  branchDialogMode: "select" | "create" | "confirm"
  historyDialogOpen: boolean
  historyDialogMode: "list" | "action"
  shortcutsDialogOpen: boolean
  setCommitDialogOpen: Dispatch<SetStateAction<boolean>>
  setFocus: Dispatch<SetStateAction<FocusTarget>>
  focus: FocusTarget
  fileCount: number
  moveToPreviousFile: () => void
  moveToNextFile: () => void
  openBranchDialog: () => void
  closeBranchDialog: () => void
  showBranchDialogList: () => void
  submitBranchSelection: () => Promise<void>
  submitBranchStrategy: () => Promise<void>
  moveBranchSelectionUp: () => void
  moveBranchSelectionDown: () => void
  moveBranchStrategyUp: () => void
  moveBranchStrategyDown: () => void
  openHistoryDialog: () => Promise<void>
  closeHistoryDialog: () => void
  backToHistoryCommitList: () => void
  submitHistoryCommitSelection: () => Promise<void>
  submitHistoryAction: () => Promise<void>
  moveCommitSelectionUp: () => void
  moveCommitSelectionDown: () => void
  moveHistoryActionUp: () => void
  moveHistoryActionDown: () => void
  commitChanges: () => Promise<void>
  createBranchAndCheckout: () => Promise<void>
  openCommitDialog: () => void
  openShortcutsDialog: () => void
  closeShortcutsDialog: () => void
  runTopAction: (action: TopAction) => Promise<void>
  toggleSelectedFileInCommit: () => void
}

export function useGitTuiKeyboard({
  renderer,
  commitDialogOpen,
  branchDialogOpen,
  branchDialogMode,
  historyDialogOpen,
  historyDialogMode,
  shortcutsDialogOpen,
  setCommitDialogOpen,
  setFocus,
  focus,
  fileCount,
  moveToPreviousFile,
  moveToNextFile,
  openBranchDialog,
  closeBranchDialog,
  showBranchDialogList,
  submitBranchSelection,
  submitBranchStrategy,
  moveBranchSelectionUp,
  moveBranchSelectionDown,
  moveBranchStrategyUp,
  moveBranchStrategyDown,
  openHistoryDialog,
  closeHistoryDialog,
  backToHistoryCommitList,
  submitHistoryCommitSelection,
  submitHistoryAction,
  moveCommitSelectionUp,
  moveCommitSelectionDown,
  moveHistoryActionUp,
  moveHistoryActionDown,
  commitChanges,
  createBranchAndCheckout,
  openCommitDialog,
  openShortcutsDialog,
  closeShortcutsDialog,
  runTopAction,
  toggleSelectedFileInCommit,
}: UseGitTuiKeyboardParams) {
  useKeyboard((key) => {
    const hasNonShiftModifier = key.ctrl || key.meta || key.option || key.super || key.hyper
    const isPlainShortcutKey = !hasNonShiftModifier
    const isMetaCopy = (key.meta || key.super) && !key.ctrl && !key.option && !key.hyper && key.name === "c"
    const isHelpKey = isPlainShortcutKey && (key.name === "?" || ((key.name === "/" || key.name === "slash") && key.shift))
    const isSpaceKey = key.name === "space" || key.name === " "
    const isEnter = key.name === "return" || key.name === "linefeed"
    const isDialogOpen = commitDialogOpen || branchDialogOpen || historyDialogOpen || shortcutsDialogOpen

    if (isMetaCopy) {
      const selectedText = renderer.getSelection?.()?.getSelectedText?.()
      if (selectedText && selectedText.length > 0) {
        renderer.copyToClipboardOSC52?.(selectedText)
        key.preventDefault()
        key.stopPropagation()
        return
      }
    }

    if (!commitDialogOpen && !branchDialogOpen && !historyDialogOpen && isHelpKey) {
      key.preventDefault()
      key.stopPropagation()
      if (shortcutsDialogOpen) {
        closeShortcutsDialog()
      } else {
        openShortcutsDialog()
      }
      return
    }

    if (shortcutsDialogOpen) {
      if (key.name === "escape") {
        key.preventDefault()
        key.stopPropagation()
        closeShortcutsDialog()
      }
      return
    }

    if (historyDialogOpen && isEnter) {
      key.preventDefault()
      key.stopPropagation()
      if (historyDialogMode === "action") {
        void submitHistoryAction()
      } else {
        void submitHistoryCommitSelection()
      }
      return
    }

    if (historyDialogOpen && focus === "history-commits" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveCommitSelectionUp()
      return
    }

    if (historyDialogOpen && focus === "history-commits" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveCommitSelectionDown()
      return
    }

    if (historyDialogOpen && focus === "history-actions" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryActionUp()
      return
    }

    if (historyDialogOpen && focus === "history-actions" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveHistoryActionDown()
      return
    }

    if (branchDialogOpen && isEnter) {
      key.preventDefault()
      key.stopPropagation()
      if (branchDialogMode === "create") {
        void createBranchAndCheckout()
      } else if (branchDialogMode === "confirm") {
        void submitBranchStrategy()
      } else {
        void submitBranchSelection()
      }
      return
    }

    if (branchDialogOpen && focus === "branch-dialog-list" && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      if (branchDialogMode === "confirm") {
        moveBranchStrategyUp()
      } else {
        moveBranchSelectionUp()
      }
      return
    }

    if (branchDialogOpen && focus === "branch-dialog-list" && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      if (branchDialogMode === "confirm") {
        moveBranchStrategyDown()
      } else {
        moveBranchSelectionDown()
      }
      return
    }

    if (commitDialogOpen && isEnter) {
      key.preventDefault()
      key.stopPropagation()
      void commitChanges()
      return
    }

    if (key.name === "escape") {
      if (historyDialogOpen) {
        if (historyDialogMode === "action") {
          backToHistoryCommitList()
        } else {
          closeHistoryDialog()
        }
        return
      }
      if (branchDialogOpen) {
        if (branchDialogMode === "select") {
          closeBranchDialog()
        } else {
          showBranchDialogList()
        }
        return
      }
      if (commitDialogOpen) {
        setCommitDialogOpen(false)
        setFocus("files")
        return
      }
      renderer.destroy()
      return
    }

    if (key.name === "tab") {
      key.preventDefault()
      key.stopPropagation()
      if (branchDialogOpen) {
        setFocus(branchDialogMode === "create" ? "branch-create" : "branch-dialog-list")
        return
      }
      if (historyDialogOpen) {
        setFocus(historyDialogMode === "action" ? "history-actions" : "history-commits")
        return
      }
      const order = commitDialogOpen ? COMMIT_FOCUS_ORDER : MAIN_FOCUS_ORDER
      setFocus((current) => {
        const currentIndex = order.findIndex((item) => item === current)
        if (currentIndex < 0) return order[0] ?? "files"
        const nextIndex = key.shift ? (currentIndex - 1 + order.length) % order.length : (currentIndex + 1) % order.length
        return order[nextIndex] ?? "files"
      })
      return
    }

    const canUseCommitShortcut = !branchDialogOpen && !historyDialogOpen && !shortcutsDialogOpen
    if (canUseCommitShortcut && key.ctrl && key.name === "c") {
      key.preventDefault()
      key.stopPropagation()
      if (commitDialogOpen) {
        void commitChanges()
      } else {
        openCommitDialog()
      }
      return
    }

    if (!isDialogOpen && isPlainShortcutKey && key.name === "b") {
      key.preventDefault()
      key.stopPropagation()
      openBranchDialog()
      return
    }

    if (!isDialogOpen && isPlainShortcutKey && key.name === "h") {
      key.preventDefault()
      key.stopPropagation()
      void openHistoryDialog()
      return
    }

    if (!isDialogOpen && isPlainShortcutKey && focus === "files" && fileCount > 0 && isSpaceKey) {
      key.preventDefault()
      key.stopPropagation()
      toggleSelectedFileInCommit()
      return
    }

    if (!isDialogOpen && isPlainShortcutKey && focus === "files" && fileCount > 0 && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveToPreviousFile()
      return
    }
    if (!isDialogOpen && isPlainShortcutKey && focus === "files" && fileCount > 0 && key.name === "down") {
      key.preventDefault()
      key.stopPropagation()
      moveToNextFile()
      return
    }

    if (!isDialogOpen && key.ctrl && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (!isDialogOpen && key.ctrl && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (!isDialogOpen && key.ctrl && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("push")
      return
    }

    if (!isDialogOpen && isPlainShortcutKey && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (!isDialogOpen && isPlainShortcutKey && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (!isDialogOpen && isPlainShortcutKey && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }

    if (key.ctrl && key.name === "return") {
      key.preventDefault()
      key.stopPropagation()
      if (commitDialogOpen) {
        void commitChanges()
      } else {
        openCommitDialog()
      }
    }
  })
}
