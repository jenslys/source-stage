import type { ChangedFile } from "../git"
import { dedupeNonEmpty } from "./utils"

export function resolveSelectedPaths(files: ChangedFile[], overridePaths: string[]): string[] {
  const changedPaths = new Set(files.map((file) => file.path))
  const selectedPaths =
    overridePaths.length > 0 ? dedupeNonEmpty(overridePaths) : files.map((file) => file.path)

  if (selectedPaths.length === 0) {
    throw new Error("No changed files selected for evaluation.")
  }

  const missing = selectedPaths.filter((path) => !changedPaths.has(path))
  if (missing.length > 0) {
    throw new Error(
      `Selected paths are not changed in this evaluation target: ${missing.join(", ")}`,
    )
  }

  return selectedPaths
}
