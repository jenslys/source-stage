import { useKeyboard } from "@opentui/react"
import type { Dispatch, SetStateAction } from "react"

import { COMMIT_FOCUS_ORDER, MAIN_FOCUS_ORDER, type FocusTarget, type TopAction } from "../ui/types"

type UseGitTuiKeyboardParams = {
  renderer: { destroy: () => void }
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
  openHistoryDialog: () => Promise<void>
  closeHistoryDialog: () => void
  backToHistoryCommitList: () => void
  submitHistoryCommitSelection: () => Promise<void>
  submitHistoryAction: () => Promise<void>
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
  openHistoryDialog,
  closeHistoryDialog,
  backToHistoryCommitList,
  submitHistoryCommitSelection,
  submitHistoryAction,
  commitChanges,
  createBranchAndCheckout,
  openCommitDialog,
  openShortcutsDialog,
  closeShortcutsDialog,
  runTopAction,
  toggleSelectedFileInCommit,
}: UseGitTuiKeyboardParams) {
  useKeyboard((key) => {
    const isHelpKey = key.name === "?" || ((key.name === "/" || key.name === "slash") && key.shift)
    const isSpaceKey = key.name === "space" || key.name === " "
    const isEnter = key.name === "return" || key.name === "linefeed"
    const isDialogOpen = commitDialogOpen || branchDialogOpen || historyDialogOpen || shortcutsDialogOpen

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

    if (!isDialogOpen && key.name === "c") {
      key.preventDefault()
      key.stopPropagation()
      openCommitDialog()
      return
    }

    if (!isDialogOpen && key.name === "b") {
      key.preventDefault()
      key.stopPropagation()
      openBranchDialog()
      return
    }

    if (!isDialogOpen && key.name === "h") {
      key.preventDefault()
      key.stopPropagation()
      void openHistoryDialog()
      return
    }

    if (!isDialogOpen && focus === "files" && fileCount > 0 && isSpaceKey) {
      key.preventDefault()
      key.stopPropagation()
      toggleSelectedFileInCommit()
      return
    }

    if (!isDialogOpen && focus === "files" && fileCount > 0 && key.name === "up") {
      key.preventDefault()
      key.stopPropagation()
      moveToPreviousFile()
      return
    }
    if (!isDialogOpen && focus === "files" && fileCount > 0 && key.name === "down") {
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
    if (!isDialogOpen && key.ctrl && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (!isDialogOpen && key.ctrl && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("push")
      return
    }

    if (!isDialogOpen && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (!isDialogOpen && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (!isDialogOpen && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (!isDialogOpen && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("push")
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
