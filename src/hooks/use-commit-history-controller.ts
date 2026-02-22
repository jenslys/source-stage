import type { SelectOption } from "@opentui/core"
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"

import type { CommitHistoryEntry, GitClient } from "../git"
import type { FocusTarget } from "../ui/types"

type CommitHistoryMode = "list" | "action"
type RunTask = (label: string, task: () => Promise<void>) => Promise<boolean>

type UseCommitHistoryControllerParams = {
  git: GitClient | null
  refreshSnapshot: () => Promise<void>
  runTask: RunTask
  setFocus: Dispatch<SetStateAction<FocusTarget>>
}

const ACTION_OPTIONS: SelectOption[] = [
  { name: "revert commit", description: "Create a new commit that reverts this one", value: "revert" },
  { name: "checkout commit", description: "Move HEAD to this commit (detached)", value: "checkout" },
]

export function useCommitHistoryController({
  git,
  refreshSnapshot,
  runTask,
  setFocus,
}: UseCommitHistoryControllerParams) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyMode, setHistoryMode] = useState<CommitHistoryMode>("list")
  const [commitOptions, setCommitOptions] = useState<SelectOption[]>([])
  const [selectedCommit, setSelectedCommit] = useState<CommitHistoryEntry | null>(null)
  const [commitIndex, setCommitIndex] = useState(0)
  const [actionIndex, setActionIndex] = useState(0)

  const selectedCommitTitle = useMemo(() => {
    if (!selectedCommit) return ""
    return `${selectedCommit.shortHash} ${selectedCommit.subject}`
  }, [selectedCommit])

  const openHistoryDialog = useCallback(async (): Promise<void> => {
    if (!git) return

    const succeeded = await runTask("LOAD HISTORY", async () => {
      const commits = await git.listCommits(200)
      if (commits.length === 0) {
        throw new Error("No commits found in this repository.")
      }

      const options = commits.map((commit) => ({
        name: `${commit.shortHash} ${commit.subject}`,
        description: `${commit.relativeDate} by ${commit.author}`,
        value: commit,
      }))

      setCommitOptions(options)
      setCommitIndex(0)
      setSelectedCommit(commits[0] ?? null)
      setActionIndex(0)
      setHistoryMode("list")
      setHistoryDialogOpen(true)
      setFocus("history-commits")
    })

    if (!succeeded) {
      setHistoryDialogOpen(false)
    }
  }, [git, runTask, setFocus])

  const closeHistoryDialog = useCallback(() => {
    setHistoryDialogOpen(false)
    setHistoryMode("list")
    setSelectedCommit(null)
    setActionIndex(0)
    setFocus("files")
  }, [setFocus])

  const backToCommitList = useCallback(() => {
    setHistoryMode("list")
    setFocus("history-commits")
  }, [setFocus])

  const submitHistoryCommitSelection = useCallback(async (): Promise<void> => {
    const selectedOption = commitOptions[commitIndex]
    const commit = selectedOption?.value as CommitHistoryEntry | undefined
    if (!commit) return

    setSelectedCommit(commit)
    setActionIndex(0)
    setHistoryMode("action")
    setFocus("history-actions")
  }, [commitIndex, commitOptions, setFocus])

  const submitHistoryAction = useCallback(async (): Promise<void> => {
    if (!git || !selectedCommit) return

    const selectedAction = ACTION_OPTIONS[actionIndex]
    const action = selectedAction?.value === "checkout" ? "checkout" : "revert"
    const label = `${action.toUpperCase()} ${selectedCommit.shortHash}`

    const succeeded = await runTask(label, async () => {
      if (action === "revert") {
        await git.revertCommit(selectedCommit.hash)
      } else {
        await git.checkoutCommit(selectedCommit.hash)
      }
      await refreshSnapshot()
    })

    if (succeeded) {
      closeHistoryDialog()
    }
  }, [actionIndex, closeHistoryDialog, git, refreshSnapshot, runTask, selectedCommit])

  return {
    historyDialogOpen,
    historyMode,
    commitOptions,
    commitIndex,
    actionOptions: ACTION_OPTIONS,
    actionIndex,
    selectedCommitTitle,
    openHistoryDialog,
    closeHistoryDialog,
    backToCommitList,
    submitHistoryCommitSelection,
    submitHistoryAction,
    onCommitIndexChange: setCommitIndex,
    onActionIndexChange: setActionIndex,
  }
}
