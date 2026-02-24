import { useKeyboard } from "@opentui/react"

import { handleDialogKeys } from "./git-tui-keyboard/handle-dialog-keys"
import { handleMainKeys } from "./git-tui-keyboard/handle-main-keys"
import { resolveKeyboardFlags } from "./git-tui-keyboard/key-flags"
import type { UseGitTuiKeyboardParams } from "./git-tui-keyboard/types"

export function useGitTuiKeyboard(params: UseGitTuiKeyboardParams) {
  useKeyboard((key) => {
    const flags = resolveKeyboardFlags(key, {
      commitDialogOpen: params.commitDialogOpen,
      branchDialogOpen: params.branchDialogOpen,
      historyDialogOpen: params.historyDialogOpen,
      shortcutsDialogOpen: params.shortcutsDialogOpen,
    })

    if (handleDialogKeys({ key, flags, params })) {
      return
    }

    void handleMainKeys({ key, flags, params })
  })
}
