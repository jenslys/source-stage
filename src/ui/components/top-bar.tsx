import type { UiTheme } from "../theme"

type TopBarProps = {
  currentBranch: string
  tracking: {
    loading: boolean
    upstream: string | null
    ahead: number
    behind: number
  }
  theme: UiTheme
}

export function TopBar({ currentBranch, tracking, theme }: TopBarProps) {
  return (
    <box
      style={{
        height: 3,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={theme.colors.mutedText}>⎇</text>
        <text fg={theme.colors.text}>{currentBranch}</text>
      </box>
      {tracking.loading ? (
        <text fg={theme.colors.subtleText}>… loading</text>
      ) : (
        <box style={{ flexDirection: "row" }}>
          {tracking.upstream ? <text fg={theme.colors.subtleText}>{tracking.upstream}</text> : null}
          {!tracking.upstream ? <text fg={theme.colors.subtleText}>◌ not pushed</text> : null}
          {tracking.upstream && tracking.ahead === 0 && tracking.behind === 0 ? (
            <text fg={theme.colors.subtleText}> ✓ up to date</text>
          ) : null}
          {tracking.ahead > 0 ? (
            <text fg={theme.colors.successText}> ↑{tracking.ahead}</text>
          ) : null}
          {tracking.behind > 0 ? (
            <text fg={theme.colors.warningText}> ↓{tracking.behind}</text>
          ) : null}
        </box>
      )}
    </box>
  )
}
