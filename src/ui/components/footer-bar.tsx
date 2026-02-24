import { useEffect, useState } from "react"

import { fitFooterLine } from "../utils"
import type { UiTheme } from "../theme"

type FooterBarProps = {
  statusMessage: string
  showShortcutsHint: boolean
  hintText?: string
  terminalWidth: number
  fatalError: string | null
  isBusy: boolean
  theme: UiTheme
}

const SPINNER_FRAMES = "⣾⣽⣻⢿⡿⣟⣯⣷"

export function FooterBar({
  statusMessage,
  showShortcutsHint,
  hintText,
  terminalWidth,
  fatalError,
  isBusy,
  theme,
}: FooterBarProps) {
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
  const shortcutsHint = showShortcutsHint ? (hintText ?? "[?] shortcuts") : ""

  if (!shortcutsHint) {
    const footerLine = fitFooterLine(statusWithSpinner, footerInnerWidth)
    return (
      <box style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text
          fg={
            fatalError
              ? theme.colors.footerError
              : isBusy
                ? theme.colors.footerBusy
                : theme.colors.footerReady
          }
        >
          {footerLine}
        </text>
      </box>
    )
  }

  if (shortcutsHint.length >= footerInnerWidth) {
    const hintOnlyLine = shortcutsHint.slice(0, footerInnerWidth)
    return (
      <box style={{ height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text fg={theme.colors.subtleText}>{hintOnlyLine}</text>
      </box>
    )
  }

  const leftWidth = Math.max(footerInnerWidth - shortcutsHint.length - 1, 0)
  const leftLine = fitFooterLine(statusWithSpinner, leftWidth)

  return (
    <box style={{ height: 1, paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
      <text
        fg={
          fatalError
            ? theme.colors.footerError
            : isBusy
              ? theme.colors.footerBusy
              : theme.colors.footerReady
        }
      >
        {leftLine}
      </text>
      <text fg={theme.colors.subtleText}> {shortcutsHint}</text>
    </box>
  )
}
