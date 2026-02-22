export type FocusTarget = "branch" | "files" | "commit-summary" | "commit-description"
export type TopAction = "refresh" | "fetch" | "pull" | "push" | "commit"

export const MAIN_FOCUS_ORDER: FocusTarget[] = ["branch", "files"]
export const COMMIT_FOCUS_ORDER: FocusTarget[] = ["commit-summary", "commit-description"]
