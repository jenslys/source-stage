import type { ChangedFile } from "../git"
import type { FileRow } from "./types"

export function inferFiletype(path: string | undefined): string | undefined {
  if (!path) return undefined
  const extension = path.includes(".") ? path.split(".").pop() : undefined
  if (!extension) return undefined
  const normalized = extension.toLowerCase()

  if (normalized === "ts" || normalized === "tsx") return "typescript"
  if (normalized === "js" || normalized === "jsx" || normalized === "mjs" || normalized === "cjs") return "javascript"
  if (normalized === "md" || normalized === "mdx") return "markdown"
  if (normalized === "yml") return "yaml"
  if (normalized === "sh" || normalized === "zsh") return "bash"

  return normalized
}

export function fitFooterLine(text: string, width: number): string {
  if (width <= 0) return text
  if (text.length > width) return text.slice(0, width)
  return text.padEnd(width, " ")
}

export function fitFooterStatusLine(left: string, right: string, width: number): string {
  if (width <= 0) return ""

  const rightText = right.trim()
  if (!rightText) return fitFooterLine(left, width)
  if (rightText.length >= width) return rightText.slice(0, width)

  const leftWidth = Math.max(width - rightText.length - 1, 0)
  const leftText = fitFooterLine(left, leftWidth)
  return `${leftText} ${rightText}`
}

export function buildFileRow(file: ChangedFile, excludedPaths: Set<string>): FileRow {
  const statusSymbol = resolveStatusSymbol(file)
  const statusColor = resolveStatusColor(statusSymbol)
  const pathParts = splitPathParts(file.path)

  return {
    path: file.path,
    included: !excludedPaths.has(file.path),
    statusSymbol,
    statusColor,
    directory: pathParts.directory,
    filename: pathParts.filename,
  }
}

function splitPathParts(path: string): { directory: string; filename: string } {
  const lastSlash = path.lastIndexOf("/")
  if (lastSlash < 0) {
    return { directory: "", filename: path }
  }
  return {
    directory: path.slice(0, lastSlash + 1),
    filename: path.slice(lastSlash + 1),
  }
}

function resolveStatusSymbol(file: ChangedFile): string {
  if (file.untracked) return "?"

  const statuses = [file.indexStatus, file.worktreeStatus]
  if (statuses.includes("D")) return "D"
  if (statuses.includes("A")) return "A"
  if (statuses.includes("R")) return "R"
  if (statuses.includes("M")) return "M"
  return statuses.find((status) => status.trim()) ?? " "
}

function resolveStatusColor(statusSymbol: string): string {
  if (statusSymbol === "A") return "#3fb950"
  if (statusSymbol === "M") return "#58a6ff"
  if (statusSymbol === "D") return "#ff7b72"
  if (statusSymbol === "R") return "#d2a8ff"
  if (statusSymbol === "?") return "#d29922"
  return "#9ca3af"
}
