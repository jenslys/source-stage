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
