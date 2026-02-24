import type { UiTheme } from "../theme"

const DIVIDER_LINE = "─".repeat(256)

type SectionDividerProps = {
  theme: UiTheme
}

export function SectionDivider({ theme }: SectionDividerProps) {
  return (
    <box style={{ width: "100%", height: 1 }}>
      <text fg={theme.colors.subtleText}>{DIVIDER_LINE}</text>
    </box>
  )
}
