import type { KeyboardFlags } from "./types"

export function resolveKeyboardFlags(
  key: {
    ctrl?: boolean
    meta?: boolean
    option?: boolean
    super?: boolean
    hyper?: boolean
    shift?: boolean
    name?: string
  },
  dialogs: {
    commitDialogOpen: boolean
    branchDialogOpen: boolean
    historyDialogOpen: boolean
    shortcutsDialogOpen: boolean
  },
): KeyboardFlags {
  const hasNonShiftModifier = Boolean(key.ctrl || key.meta || key.option || key.super || key.hyper)
  const isPlainShortcutKey = !hasNonShiftModifier
  const isMetaCopy = Boolean(
    (key.meta || key.super) && !key.ctrl && !key.option && !key.hyper && key.name === "c",
  )
  const isHelpKey =
    isPlainShortcutKey &&
    (key.name === "?" || ((key.name === "/" || key.name === "slash") && Boolean(key.shift)))
  const isSpaceKey = key.name === "space" || key.name === " "
  const isEnter = key.name === "return" || key.name === "linefeed"
  const isDialogOpen =
    dialogs.commitDialogOpen ||
    dialogs.branchDialogOpen ||
    dialogs.historyDialogOpen ||
    dialogs.shortcutsDialogOpen

  return {
    hasNonShiftModifier,
    isPlainShortcutKey,
    isMetaCopy,
    isHelpKey,
    isSpaceKey,
    isEnter,
    isDialogOpen,
  }
}
