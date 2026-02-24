import type { ChangedFile } from "../git"
import type { FileRow } from "./types"

export function inferFiletype(path: string | undefined): string | undefined {
  if (!path) return undefined
  const extension = path.includes(".") ? path.split(".").pop() : undefined
  if (!extension) return undefined
  const normalized = extension.toLowerCase()

  if (normalized === "ts" || normalized === "tsx") return "typescript"
  if (normalized === "js" || normalized === "jsx" || normalized === "mjs" || normalized === "cjs")
    return "javascript"
  if (normalized === "md" || normalized === "mdx") return "markdown"
  if (normalized === "yml") return "yaml"
  if (normalized === "sh" || normalized === "zsh") return "bash"

  return normalized
}

export function fitLine(text: string, width: number): string {
  if (width <= 0) return ""
  if (text.length <= width) return text.padEnd(width, " ")
  if (width <= 3) return text.slice(0, width)
  return `${text.slice(0, width - 3)}...`
}

export function fitPathForWidth(path: string, width: number): string {
  const pathParts = splitPathParts(path)
  const fitted = fitPathPartsForWidth(pathParts.directory, pathParts.filename, width)
  return `${fitted.directory}${fitted.filename}`
}

export function fitPathPartsForWidth(
  directory: string,
  filename: string,
  width: number,
): { directory: string; filename: string } {
  if (width <= 0) return { directory: "", filename: "" }

  const fullPath = `${directory}${filename}`
  if (fullPath.length <= width) {
    return { directory, filename }
  }

  if (filename.length >= width) {
    return {
      directory: "",
      filename: fitPathTail(filename, width),
    }
  }

  const directoryWidth = width - filename.length
  if (directoryWidth <= 3) {
    return { directory: "", filename }
  }

  return {
    directory: fitMiddle(directory, directoryWidth),
    filename,
  }
}

export function fitFooterLine(text: string, width: number): string {
  if (width <= 0) return text
  return fitLine(text, width)
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

export function formatTrackingSummary(
  upstream: string | null,
  ahead: number,
  behind: number,
): string {
  if (!upstream) {
    return "◌ unpublished"
  }
  if (ahead === 0 && behind === 0) {
    return "✓ synced"
  }

  const parts: string[] = []
  if (ahead > 0) {
    parts.push(`↑${ahead}`)
  }
  if (behind > 0) {
    parts.push(`↓${behind}`)
  }
  return parts.join(" ")
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

function fitPathTail(path: string, width: number): string {
  if (width <= 0) return ""
  if (path.length <= width) return path
  if (width <= 3) return path.slice(0, width)
  return `...${path.slice(-(width - 3))}`
}

function fitMiddle(text: string, width: number): string {
  if (width <= 0) return ""
  if (text.length <= width) return text
  if (width <= 3) return text.slice(0, width)

  const visible = width - 3
  const head = Math.ceil(visible / 2)
  const tail = Math.floor(visible / 2)
  return `${text.slice(0, head)}...${text.slice(text.length - tail)}`
}

function resolveStatusSymbol(file: ChangedFile): string {
  if (file.untracked) return "◌"

  const statuses = [file.indexStatus, file.worktreeStatus]
  if (statuses.includes("D")) return "−"
  if (statuses.includes("A")) return "+"
  if (statuses.includes("R")) return "→"
  if (statuses.includes("M")) return "●"
  return "·"
}

function resolveStatusColor(statusSymbol: string): string {
  if (statusSymbol === "+") return "#3fb950"
  if (statusSymbol === "●") return "#58a6ff"
  if (statusSymbol === "−") return "#ff7b72"
  if (statusSymbol === "→") return "#d2a8ff"
  if (statusSymbol === "◌") return "#d29922"
  return "#9ca3af"
}
