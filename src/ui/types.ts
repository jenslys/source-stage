export type FocusTarget =
  | "files"
  | "branch-dialog-list"
  | "branch-create"
  | "history-commits"
  | "history-actions"
  | "commit-summary"
  | "commit-description"
export type TopAction = "refresh" | "fetch" | "pull" | "push" | "commit"

export const MAIN_FOCUS_ORDER: FocusTarget[] = ["files"]
export const COMMIT_FOCUS_ORDER: FocusTarget[] = ["commit-summary", "commit-description"]

export type FileRow = {
  path: string
  included: boolean
  statusSymbol: string
  statusColor: string
  directory: string
  filename: string
}
