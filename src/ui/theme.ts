import type { SyntaxStyle } from "@opentui/core"
import { execFileSync } from "node:child_process"

import { createDiffSyntaxStyle } from "./diff-style"

export type UiThemeMode = "dark" | "light"
export type UiThemePreference = UiThemeMode | "auto"

type UiColors = {
  title: string
  text: string
  mutedText: string
  subtleText: string
  hintText: string
  selectedRowBackground: string
  selectText: string
  selectSelectedBackground: string
  selectSelectedText: string
  selectFocusedText: string
  inputText: string
  inputFocusedText: string
  secondaryInputText: string
  footerReady: string
  footerBusy: string
  footerError: string
  diffForeground: string
  diffLineNumber: string
  diffAddedBackground: string
  diffRemovedBackground: string
  diffAddedLineNumberBackground: string
  diffRemovedLineNumberBackground: string
}

export type UiTheme = {
  mode: UiThemeMode
  colors: UiColors
  diffSyntaxStyle: SyntaxStyle
}

const DARK_COLORS: UiColors = {
  title: "#f5f5f5",
  text: "#f3f4f6",
  mutedText: "#737373",
  subtleText: "#525252",
  hintText: "#9ca3af",
  selectedRowBackground: "#101010",
  selectText: "#9ca3af",
  selectSelectedBackground: "#111111",
  selectSelectedText: "#ffffff",
  selectFocusedText: "#f3f4f6",
  inputText: "#f3f4f6",
  inputFocusedText: "#f9fafb",
  secondaryInputText: "#d1d5db",
  footerReady: "#58a6ff",
  footerBusy: "#d29922",
  footerError: "#ff7b72",
  diffForeground: "#e5e7eb",
  diffLineNumber: "#525252",
  diffAddedBackground: "#06180c",
  diffRemovedBackground: "#220909",
  diffAddedLineNumberBackground: "#0a2212",
  diffRemovedLineNumberBackground: "#2c1010",
}

const LIGHT_COLORS: UiColors = {
  title: "#111827",
  text: "#1f2937",
  mutedText: "#6b7280",
  subtleText: "#9ca3af",
  hintText: "#64748b",
  selectedRowBackground: "#e5e7eb",
  selectText: "#334155",
  selectSelectedBackground: "#dbeafe",
  selectSelectedText: "#0f172a",
  selectFocusedText: "#111827",
  inputText: "#111827",
  inputFocusedText: "#020617",
  secondaryInputText: "#334155",
  footerReady: "#1d4ed8",
  footerBusy: "#b45309",
  footerError: "#b91c1c",
  diffForeground: "#111827",
  diffLineNumber: "#6b7280",
  diffAddedBackground: "#dff3e4",
  diffRemovedBackground: "#fde2e2",
  diffAddedLineNumberBackground: "#c7e9d0",
  diffRemovedLineNumberBackground: "#f7c6c6",
}

const DARK_THEME: UiTheme = {
  mode: "dark",
  colors: DARK_COLORS,
  diffSyntaxStyle: createDiffSyntaxStyle("dark"),
}

const LIGHT_THEME: UiTheme = {
  mode: "light",
  colors: LIGHT_COLORS,
  diffSyntaxStyle: createDiffSyntaxStyle("light"),
}

const THEME_CACHE_TTL_MS = 1000
let cachedTheme: UiTheme | null = null
let cachedThemeAt = 0
let cachedPreference: UiThemePreference | null = null

export function resolveUiTheme(preference: UiThemePreference = "auto"): UiTheme {
  const now = Date.now()
  if (cachedTheme && cachedPreference === preference && now - cachedThemeAt < THEME_CACHE_TTL_MS) {
    return cachedTheme
  }

  const mode = preference === "auto" ? resolveAutoThemeMode() : preference
  cachedTheme = mode === "light" ? LIGHT_THEME : DARK_THEME
  cachedThemeAt = now
  cachedPreference = preference
  return cachedTheme
}

function resolveAutoThemeMode(): UiThemeMode {
  const explicitBackground = process.env.TERM_BACKGROUND?.trim().toLowerCase()
  if (explicitBackground === "light") return "light"
  if (explicitBackground === "dark") return "dark"

  const osMode = resolveThemeModeFromMacOs()
  if (osMode) return osMode

  return "dark"
}

function resolveThemeModeFromMacOs(): UiThemeMode | null {
  if (process.platform !== "darwin") return null

  try {
    const output = execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 200,
      maxBuffer: 16 * 1024,
    })
    return output.trim().toLowerCase() === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}
