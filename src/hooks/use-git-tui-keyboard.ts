import { useKeyboard } from "@opentui/react"
import type { Dispatch, SetStateAction } from "react"

import { COMMIT_FOCUS_ORDER, MAIN_FOCUS_ORDER, type FocusTarget, type TopAction } from "../ui/types"

type UseGitTuiKeyboardParams = {
  renderer: { destroy: () => void }
  commitDialogOpen: boolean
  branchDialogOpen: boolean
  branchDialogMode: "select" | "create" | "confirm"
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
  commitChanges: () => Promise<void>
  createBranchAndCheckout: () => Promise<void>
  runTopAction: (action: TopAction) => Promise<void>
  toggleSelectedFileInCommit: () => void
}

export function useGitTuiKeyboard({
  renderer,
  commitDialogOpen,
  branchDialogOpen,
  branchDialogMode,
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
  commitChanges,
  createBranchAndCheckout,
  runTopAction,
  toggleSelectedFileInCommit,
}: UseGitTuiKeyboardParams) {
  useKeyboard((key) => {
    const isEnter = key.name === "return" || key.name === "linefeed"
    const isDialogOpen = commitDialogOpen || branchDialogOpen

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
      setCommitDialogOpen(true)
      setFocus("commit-summary")
      return
    }

    if (!isDialogOpen && key.name === "b") {
      key.preventDefault()
      key.stopPropagation()
      openBranchDialog()
      return
    }

    if (!isDialogOpen && key.name === "u") {
      key.preventDefault()
      key.stopPropagation()
      toggleSelectedFileInCommit()
      return
    }

    if (!isDialogOpen && focus === "files" && fileCount > 0 && (key.name === "up" || key.name === "k")) {
      key.preventDefault()
      key.stopPropagation()
      moveToPreviousFile()
      return
    }
    if (!isDialogOpen && focus === "files" && fileCount > 0 && (key.name === "down" || key.name === "j")) {
      key.preventDefault()
      key.stopPropagation()
      moveToNextFile()
      return
    }

    if (key.ctrl && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (key.ctrl && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (key.ctrl && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (key.ctrl && key.name === "p") {
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
        setCommitDialogOpen(true)
        setFocus("commit-summary")
      }
    }
  })
}
