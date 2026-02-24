import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"

import type { CommitFileChange, CommitHistoryEntry, GitClient } from "../git"
import { useCommitDiffLoader } from "./commit-history/use-commit-diff-loader"
import {
  ACTION_OPTIONS,
  resolveHistoryAction,
  toCommitFileOptions,
  toCommitOptions,
} from "./commit-history/options"
import { useCommitFilesLoader } from "./commit-history/use-commit-files-loader"
import { clampSelectionIndex, getNextIndex, getPreviousIndex } from "./selection-index"
import type { RunTask } from "./use-task-runner"
import type { CommitHistoryMode, FocusTarget } from "../ui/types"
import { inferFiletype } from "../ui/utils"

type UseCommitHistoryControllerParams = {
  git: GitClient | null
  refreshSnapshot: () => Promise<void>
  runTask: RunTask
  setFocus: Dispatch<SetStateAction<FocusTarget>>
}

export function useCommitHistoryController({
  git,
  refreshSnapshot,
  runTask,
  setFocus,
}: UseCommitHistoryControllerParams) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyMode, setHistoryMode] = useState<CommitHistoryMode>("list")
  const [commits, setCommits] = useState<CommitHistoryEntry[]>([])
  const [selectedCommit, setSelectedCommit] = useState<CommitHistoryEntry | null>(null)
  const [commitIndex, setCommitIndex] = useState(0)
  const [actionIndex, setActionIndex] = useState(0)
  const [historyFiles, setHistoryFiles] = useState<CommitFileChange[]>([])
  const [historyFileIndex, setHistoryFileIndex] = useState(0)
  const [historyFilesLoading, setHistoryFilesLoading] = useState(false)
  const [historyDiffText, setHistoryDiffText] = useState("")
  const [historyDiffMessage, setHistoryDiffMessage] = useState<string | null>(
    "Select a commit to view files",
  )

  const historyFilesCacheRef = useRef<Map<string, CommitFileChange[]>>(new Map())
  const historyDiffCacheRef = useRef<Map<string, string>>(new Map())
  const previousFilesCommitHashRef = useRef<string | null>(null)
  const historyFilesRequestIdRef = useRef(0)
  const historyDiffRequestIdRef = useRef(0)

  const selectedListCommit = commits[commitIndex] ?? null
  const selectedHistoryFile = historyFiles[historyFileIndex] ?? null

  useCommitFilesLoader({
    git,
    historyDialogOpen,
    selectedListCommit,
    setHistoryFilesLoading,
    setHistoryFiles,
    setHistoryFileIndex,
    setHistoryDiffText,
    setHistoryDiffMessage,
    historyFilesCacheRef,
    previousFilesCommitHashRef,
    historyFilesRequestIdRef,
  })

  useCommitDiffLoader({
    git,
    historyDialogOpen,
    selectedListCommit,
    selectedHistoryFile,
    historyFilesLoading,
    historyFilesCount: historyFiles.length,
    setHistoryDiffText,
    setHistoryDiffMessage,
    historyDiffCacheRef,
    historyDiffRequestIdRef,
  })

  const commitOptions = useMemo(() => toCommitOptions(commits), [commits])
  const historyFileOptions = useMemo(() => toCommitFileOptions(historyFiles), [historyFiles])

  const selectedCommitPreviewTitle = useMemo(() => {
    if (!selectedListCommit) return ""
    return `${selectedListCommit.shortHash} ${selectedListCommit.subject}`
  }, [selectedListCommit])

  const selectedCommitTitle = useMemo(() => {
    if (!selectedCommit) return ""
    return `${selectedCommit.shortHash} ${selectedCommit.subject}`
  }, [selectedCommit])

  const selectedHistoryFilePath = useMemo(
    () => selectedHistoryFile?.displayPath ?? "",
    [selectedHistoryFile],
  )

  const historyDiffFiletype = useMemo(
    () => inferFiletype(selectedHistoryFile?.path),
    [selectedHistoryFile],
  )

  const resetHistoryCaches = useCallback(() => {
    historyFilesCacheRef.current.clear()
    historyDiffCacheRef.current.clear()
    previousFilesCommitHashRef.current = null
    historyFilesRequestIdRef.current += 1
    historyDiffRequestIdRef.current += 1
  }, [])

  const openHistoryDialog = useCallback(async (): Promise<void> => {
    if (!git) return

    const succeeded = await runTask("LOAD HISTORY", async () => {
      const loadedCommits = await git.listCommits()
      if (loadedCommits.length === 0) {
        throw new Error("No commits found in this repository.")
      }

      resetHistoryCaches()
      setCommits(loadedCommits)
      setCommitIndex(0)
      setSelectedCommit(loadedCommits[0] ?? null)
      setActionIndex(0)
      setHistoryFiles([])
      setHistoryFileIndex(0)
      setHistoryFilesLoading(false)
      setHistoryDiffText("")
      setHistoryDiffMessage("Select a commit to view files")
      setHistoryMode("list")
      setHistoryDialogOpen(true)
      setFocus("history-commits")
    })

    if (!succeeded) {
      setHistoryDialogOpen(false)
    }
  }, [git, resetHistoryCaches, runTask, setFocus])

  const closeHistoryDialog = useCallback(() => {
    historyFilesRequestIdRef.current += 1
    historyDiffRequestIdRef.current += 1
    previousFilesCommitHashRef.current = null
    setHistoryDialogOpen(false)
    setHistoryMode("list")
    setCommits([])
    setSelectedCommit(null)
    setCommitIndex(0)
    setActionIndex(0)
    setHistoryFiles([])
    setHistoryFileIndex(0)
    setHistoryFilesLoading(false)
    setHistoryDiffText("")
    setHistoryDiffMessage("Select a commit to view files")
    setFocus("files")
  }, [setFocus])

  const backToCommitList = useCallback(() => {
    setHistoryMode("list")
    setFocus("history-commits")
  }, [setFocus])

  const submitHistoryCommitSelection = useCallback(async (): Promise<void> => {
    if (!selectedListCommit) return
    setSelectedCommit(selectedListCommit)
    setActionIndex(0)
    setHistoryMode("action")
    setFocus("history-actions")
  }, [selectedListCommit, setFocus])

  const submitHistoryAction = useCallback(async (): Promise<void> => {
    if (!git || !selectedCommit) return

    const action = resolveHistoryAction(actionIndex)
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

  const focusHistoryCommits = useCallback(() => {
    setFocus("history-commits")
  }, [setFocus])

  const focusHistoryFiles = useCallback(() => {
    setFocus("history-files")
  }, [setFocus])

  const focusHistoryActions = useCallback(() => {
    setFocus("history-actions")
  }, [setFocus])

  const setCommitSelection = useCallback(
    (index: number) => {
      const total = commits.length
      if (total <= 0) return
      const normalized = clampSelectionIndex(index, total)
      if (normalized === commitIndex) return
      setHistoryFiles([])
      setHistoryFileIndex(0)
      setHistoryFilesLoading(true)
      setHistoryDiffText("")
      setHistoryDiffMessage("Loading files...")
      setCommitIndex(normalized)
    },
    [commitIndex, commits.length],
  )

  const setHistoryFileSelection = useCallback(
    (index: number) => {
      const total = historyFiles.length
      if (total <= 0) return
      const normalized = clampSelectionIndex(index, total)
      if (normalized === historyFileIndex) return
      setHistoryFileIndex(normalized)
    },
    [historyFileIndex, historyFiles.length],
  )

  const setHistoryActionSelection = useCallback(
    (index: number) => {
      const total = ACTION_OPTIONS.length
      if (total <= 0) return
      const normalized = clampSelectionIndex(index, total)
      if (normalized === actionIndex) return
      setActionIndex(normalized)
    },
    [actionIndex],
  )

  const moveCommitSelectionUp = useCallback(() => {
    setCommitSelection(getPreviousIndex(commitIndex, commits.length))
  }, [commitIndex, commits.length, setCommitSelection])

  const moveCommitSelectionDown = useCallback(() => {
    setCommitSelection(getNextIndex(commitIndex, commits.length))
  }, [commitIndex, commits.length, setCommitSelection])

  const moveHistoryFileSelectionUp = useCallback(() => {
    setHistoryFileSelection(getPreviousIndex(historyFileIndex, historyFiles.length))
  }, [historyFileIndex, historyFiles.length, setHistoryFileSelection])

  const moveHistoryFileSelectionDown = useCallback(() => {
    setHistoryFileSelection(getNextIndex(historyFileIndex, historyFiles.length))
  }, [historyFileIndex, historyFiles.length, setHistoryFileSelection])

  const moveHistoryActionUp = useCallback(() => {
    setHistoryActionSelection(getPreviousIndex(actionIndex, ACTION_OPTIONS.length))
  }, [actionIndex, setHistoryActionSelection])

  const moveHistoryActionDown = useCallback(() => {
    setHistoryActionSelection(getNextIndex(actionIndex, ACTION_OPTIONS.length))
  }, [actionIndex, setHistoryActionSelection])

  return {
    historyDialogOpen,
    historyMode,
    commitOptions,
    commitIndex,
    actionOptions: ACTION_OPTIONS,
    actionIndex,
    historyFileOptions,
    historyFileIndex,
    selectedCommitTitle,
    selectedCommitPreviewTitle,
    selectedHistoryFilePath,
    historyDiffText,
    historyDiffMessage,
    historyDiffFiletype,
    openHistoryDialog,
    closeHistoryDialog,
    backToCommitList,
    submitHistoryCommitSelection,
    submitHistoryAction,
    focusHistoryCommits,
    focusHistoryFiles,
    focusHistoryActions,
    setCommitSelection,
    setHistoryFileSelection,
    setHistoryActionSelection,
    moveCommitSelectionUp,
    moveCommitSelectionDown,
    moveHistoryFileSelectionUp,
    moveHistoryFileSelectionDown,
    moveHistoryActionUp,
    moveHistoryActionDown,
  }
}
