import { fitFooterStatusLine } from "../utils"

type FooterBarProps = {
  statusMessage: string
  topStatus: string
  terminalWidth: number
  fatalError: string | null
  isBusy: boolean
}

export function FooterBar({ statusMessage, topStatus, terminalWidth, fatalError, isBusy }: FooterBarProps) {
  const footerInnerWidth = Math.max(terminalWidth - 2, 0)
  const footerLine = fitFooterStatusLine(statusMessage, topStatus, footerInnerWidth)

  return (
    <box style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={fatalError ? "#ff7b72" : isBusy ? "#d29922" : "#58a6ff"}>{footerLine}</text>
    </box>
  )
}
