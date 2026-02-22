import { RGBA, SyntaxStyle } from "@opentui/core"

type DiffStyleMode = "dark" | "light"

const DARK_DIFF_SYNTAX_STYLE = SyntaxStyle.fromStyles({
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

const LIGHT_DIFF_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#7c3aed"), italic: true },
  string: { fg: RGBA.fromHex("#15803d") },
  comment: { fg: RGBA.fromHex("#6b7280"), italic: true },
  number: { fg: RGBA.fromHex("#c2410c") },
  function: { fg: RGBA.fromHex("#1d4ed8") },
  type: { fg: RGBA.fromHex("#a16207") },
  variable: { fg: RGBA.fromHex("#be123c") },
  operator: { fg: RGBA.fromHex("#0e7490") },
  punctuation: { fg: RGBA.fromHex("#334155") },
  default: { fg: RGBA.fromHex("#111827") },
})

export function createDiffSyntaxStyle(mode: DiffStyleMode): SyntaxStyle {
  return mode === "light" ? LIGHT_DIFF_SYNTAX_STYLE : DARK_DIFF_SYNTAX_STYLE
}
