import type { KeyboardFlags, UseGitTuiKeyboardParams } from "./types"

type KeyboardEventLike = {
  ctrl: boolean
  name?: string
  preventDefault: () => void
  stopPropagation: () => void
}

export function handleMainKeys({
  key,
  flags,
  params,
}: {
  key: KeyboardEventLike
  flags: KeyboardFlags
  params: UseGitTuiKeyboardParams
}): boolean {
  const {
    focus,
    fileCount,
    isDialogOpen,
    moveToPreviousFile,
    moveToNextFile,
    openCommitDialog,
    openDiscardDialog,
    openSelectedFileInEditor,
    openBranchDialog,
    openHistoryDialog,
    runTopAction,
    toggleSelectedFileInCommit,
    commitDialogOpen,
    commitChanges,
  } = {
    ...params,
    isDialogOpen: flags.isDialogOpen,
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "c") {
    key.preventDefault()
    key.stopPropagation()
    openCommitDialog()
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "b") {
    key.preventDefault()
    key.stopPropagation()
    openBranchDialog()
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "h") {
    key.preventDefault()
    key.stopPropagation()
    void openHistoryDialog()
    return true
  }

  if (
    !isDialogOpen &&
    flags.isPlainShortcutKey &&
    focus === "files" &&
    fileCount > 0 &&
    flags.isSpaceKey
  ) {
    key.preventDefault()
    key.stopPropagation()
    toggleSelectedFileInCommit()
    return true
  }

  if (
    !isDialogOpen &&
    flags.isPlainShortcutKey &&
    focus === "files" &&
    fileCount > 0 &&
    key.name === "up"
  ) {
    key.preventDefault()
    key.stopPropagation()
    moveToPreviousFile()
    return true
  }

  if (
    !isDialogOpen &&
    flags.isPlainShortcutKey &&
    focus === "files" &&
    fileCount > 0 &&
    key.name === "down"
  ) {
    key.preventDefault()
    key.stopPropagation()
    moveToNextFile()
    return true
  }

  if (!isDialogOpen && flags.isEnter && focus === "files" && fileCount > 0) {
    key.preventDefault()
    key.stopPropagation()
    void openSelectedFileInEditor()
    return true
  }

  if (
    !isDialogOpen &&
    flags.isPlainShortcutKey &&
    focus === "files" &&
    fileCount > 0 &&
    (key.name === "delete" || key.name === "backspace")
  ) {
    key.preventDefault()
    key.stopPropagation()
    openDiscardDialog()
    return true
  }

  if (!isDialogOpen && key.ctrl && key.name === "r") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("refresh")
    return true
  }

  if (!isDialogOpen && key.ctrl && key.name === "f") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("fetch")
    return true
  }

  if (!isDialogOpen && key.ctrl && key.name === "p") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("push")
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "r") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("refresh")
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "f") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("fetch")
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "p") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("pull")
    return true
  }

  if (!isDialogOpen && flags.isPlainShortcutKey && key.name === "u") {
    key.preventDefault()
    key.stopPropagation()
    void runTopAction("merge-main")
    return true
  }

  if (key.ctrl && key.name === "return") {
    key.preventDefault()
    key.stopPropagation()
    if (commitDialogOpen) {
      void commitChanges()
    } else {
      openCommitDialog()
    }
    return true
  }

  return false
}
