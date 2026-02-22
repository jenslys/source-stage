import { fitFooterLine } from "../utils"

type FooterBarProps = {
  statusMessage: string
  topStatus: string
  terminalWidth: number
  fatalError: string | null
  isBusy: boolean
}

export function FooterBar({ statusMessage, topStatus, terminalWidth, fatalError, isBusy }: FooterBarProps) {
  const footerInnerWidth = Math.max(terminalWidth - 2, 0)
  const footerStatusLine = fitFooterLine(statusMessage, footerInnerWidth)
  const footerHintsLine = fitFooterLine(
    `${topStatus} | tab focus | c commit | r refresh | f fetch | l pull | p push | enter commit | esc exit`,
    footerInnerWidth,
  )

  return (
    <box style={{ height: 2, flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
      <text fg={fatalError ? "#ff7b72" : isBusy ? "#d29922" : "#58a6ff"}>{footerStatusLine}</text>
      <text fg="#4b5563">{footerHintsLine}</text>
    </box>
  )
}
