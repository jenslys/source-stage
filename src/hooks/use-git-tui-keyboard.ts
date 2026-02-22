import { useKeyboard } from "@opentui/react"
import type { Dispatch, SetStateAction } from "react"

import { COMMIT_FOCUS_ORDER, MAIN_FOCUS_ORDER, type FocusTarget, type TopAction } from "../ui/types"

type UseGitTuiKeyboardParams = {
  renderer: { destroy: () => void }
  commitDialogOpen: boolean
  setCommitDialogOpen: Dispatch<SetStateAction<boolean>>
  setFocus: Dispatch<SetStateAction<FocusTarget>>
  commitChanges: () => Promise<void>
  runTopAction: (action: TopAction) => Promise<void>
}

export function useGitTuiKeyboard({
  renderer,
  commitDialogOpen,
  setCommitDialogOpen,
  setFocus,
  commitChanges,
  runTopAction,
}: UseGitTuiKeyboardParams) {
  useKeyboard((key) => {
    const isEnter = key.name === "return" || key.name === "linefeed"

    if (commitDialogOpen && isEnter) {
      key.preventDefault()
      key.stopPropagation()
      void commitChanges()
      return
    }

    if (key.name === "escape") {
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
      const order = commitDialogOpen ? COMMIT_FOCUS_ORDER : MAIN_FOCUS_ORDER
      setFocus((current) => {
        const currentIndex = order.findIndex((item) => item === current)
        if (currentIndex < 0) return order[0] ?? "files"
        const nextIndex = key.shift ? (currentIndex - 1 + order.length) % order.length : (currentIndex + 1) % order.length
        return order[nextIndex] ?? "files"
      })
      return
    }

    if (!commitDialogOpen && key.name === "c") {
      key.preventDefault()
      key.stopPropagation()
      setCommitDialogOpen(true)
      setFocus("commit-summary")
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

    if (!commitDialogOpen && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (!commitDialogOpen && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (!commitDialogOpen && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (!commitDialogOpen && key.name === "p") {
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
