import type { UiTheme } from "../../theme"

export function resolveRowTextColor({
  selected,
  focused,
  theme,
}: {
  selected: boolean
  focused: boolean
  theme: UiTheme
}): string {
  if (selected && focused) return theme.colors.selectSelectedText
  if (selected) return theme.colors.selectText
  if (focused) return theme.colors.text
  return theme.colors.subtleText
}

export function resolveRowBackground({
  selected,
  focused,
  theme,
}: {
  selected: boolean
  focused: boolean
  theme: UiTheme
}): { backgroundColor?: string } {
  if (selected && focused) {
    return { backgroundColor: theme.colors.selectSelectedBackground }
  }
  return {}
}

export function getPaneWidths(terminalWidth: number): {
  commitsPaneWidth: number
  filesPaneWidth: number
} {
  if (!Number.isFinite(terminalWidth) || terminalWidth <= 0) {
    return { commitsPaneWidth: 42, filesPaneWidth: 34 }
  }

  const minimumCommitsWidth = 30
  const minimumFilesWidth = 26
  const minimumDiffWidth = 48
  const preferredCommitsWidth = Math.floor(terminalWidth * 0.32)
  const maxCommitsWidth = Math.max(
    minimumCommitsWidth,
    terminalWidth - minimumFilesWidth - minimumDiffWidth,
  )
  const commitsPaneWidth = clamp(preferredCommitsWidth, minimumCommitsWidth, maxCommitsWidth)

  const preferredFilesWidth = Math.floor(terminalWidth * 0.24)
  const maxFilesWidth = Math.max(
    minimumFilesWidth,
    terminalWidth - commitsPaneWidth - minimumDiffWidth,
  )
  const filesPaneWidth = clamp(preferredFilesWidth, minimumFilesWidth, maxFilesWidth)

  return {
    commitsPaneWidth,
    filesPaneWidth,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
