import { RGBA, SyntaxStyle } from "@opentui/core"

export const DIFF_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#c792ea"), italic: true },
  string: { fg: RGBA.fromHex("#c3e88d") },
  comment: { fg: RGBA.fromHex("#6a737d"), italic: true },
  number: { fg: RGBA.fromHex("#f78c6c") },
  function: { fg: RGBA.fromHex("#82aaff") },
  type: { fg: RGBA.fromHex("#ffcb6b") },
  variable: { fg: RGBA.fromHex("#f07178") },
  operator: { fg: RGBA.fromHex("#89ddff") },
  punctuation: { fg: RGBA.fromHex("#cdd6f4") },
  default: { fg: RGBA.fromHex("#e6edf3") },
})
