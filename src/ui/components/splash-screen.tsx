import type { UiTheme } from "../theme"

type SplashScreenProps = {
  theme: UiTheme
}

export function SplashScreen({ theme }: SplashScreenProps) {
  return (
    <box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingLeft: 2, paddingRight: 2 }}>
      <box style={{ flexDirection: "column", alignItems: "center", gap: 1 }}>
        <ascii-font text="STAGE" font="slick" color={theme.colors.footerReady} />
        <text fg={theme.colors.subtleText}>loading repository...</text>
      </box>
    </box>
  )
}
