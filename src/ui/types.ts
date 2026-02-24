export type FocusTarget =
  | "files"
  | "branch-dialog-list"
  | "branch-create"
  | "history-commits"
  | "history-files"
  | "history-actions"
  | "commit-summary"
  | "commit-description"
export type TopAction = "refresh" | "fetch" | "pull" | "push" | "commit"
export type BranchDialogMode = "select" | "create" | "confirm"
export type CommitHistoryMode = "list" | "action"

export const MAIN_FOCUS_ORDER: FocusTarget[] = ["files"]
export const COMMIT_FOCUS_ORDER: FocusTarget[] = ["commit-summary", "commit-description"]
export const HISTORY_LIST_FOCUS_ORDER: FocusTarget[] = ["history-commits", "history-files"]

export type FileRow = {
  path: string
  included: boolean
  statusSymbol: string
  statusColor: string
  directory: string
  filename: string
}
