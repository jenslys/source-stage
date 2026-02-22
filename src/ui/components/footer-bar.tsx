import { useEffect, useState } from "react"

import { fitFooterStatusLine } from "../utils"
import type { UiTheme } from "../theme"

type FooterBarProps = {
  statusMessage: string
  topStatus: string
  terminalWidth: number
  fatalError: string | null
  isBusy: boolean
  theme: UiTheme
}

const SPINNER_FRAMES = "⣾⣽⣻⢿⡿⣟⣯⣷"

export function FooterBar({ statusMessage, topStatus, terminalWidth, fatalError, isBusy, theme }: FooterBarProps) {
  const [spinnerIndex, setSpinnerIndex] = useState(0)

  useEffect(() => {
    if (!isBusy) {
      setSpinnerIndex(0)
      return
    }

    const timer = setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % SPINNER_FRAMES.length)
    }, 90)

    return () => clearInterval(timer)
  }, [isBusy])

  const busyPrefix = isBusy ? `${SPINNER_FRAMES[spinnerIndex]} ` : ""
  const statusWithSpinner = `${busyPrefix}${statusMessage}`
  const footerInnerWidth = Math.max(terminalWidth - 2, 0)
  const footerLine = fitFooterStatusLine(statusWithSpinner, topStatus, footerInnerWidth)

  return (
    <box style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={fatalError ? theme.colors.footerError : isBusy ? theme.colors.footerBusy : theme.colors.footerReady}>{footerLine}</text>
    </box>
  )
}
