import type { SelectOption } from "@opentui/core"
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"

import type { CommitFileChange, CommitHistoryEntry, GitClient } from "../git"
import type { FocusTarget } from "../ui/types"
import { inferFiletype } from "../ui/utils"

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
  const [historyFileOptions, setHistoryFileOptions] = useState<SelectOption[]>([])
  const [historyFileIndex, setHistoryFileIndex] = useState(0)
  const [historyFilesLoading, setHistoryFilesLoading] = useState(false)
  const [historyDiffText, setHistoryDiffText] = useState("")
  const [historyDiffMessage, setHistoryDiffMessage] = useState<string | null>("Select a commit to view files")

  const historyFilesCacheRef = useRef<Map<string, CommitFileChange[]>>(new Map())
  const historyDiffCacheRef = useRef<Map<string, string>>(new Map())
  const previousFilesCommitHashRef = useRef<string | null>(null)
  const historyFilesRequestIdRef = useRef(0)
  const historyDiffRequestIdRef = useRef(0)

  const selectedListCommit = useMemo(
    () => getCommitFromOption(commitOptions[commitIndex]),
    [commitIndex, commitOptions],
  )

  const selectedHistoryFile = useMemo(
    () => getCommitFileFromOption(historyFileOptions[historyFileIndex]),
    [historyFileIndex, historyFileOptions],
  )

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

  useEffect(() => {
    if (!historyDialogOpen || !git) {
      previousFilesCommitHashRef.current = null
      setHistoryFilesLoading(false)
      setHistoryFileOptions([])
      setHistoryFileIndex(0)
      return
    }

    const commit = selectedListCommit
    if (!commit) {
      previousFilesCommitHashRef.current = null
      setHistoryFilesLoading(false)
      setHistoryFileOptions([])
      setHistoryFileIndex(0)
      return
    }

    const commitChanged = previousFilesCommitHashRef.current !== commit.hash
    previousFilesCommitHashRef.current = commit.hash

    const cachedFiles = historyFilesCacheRef.current.get(commit.hash)
    if (cachedFiles) {
      const options = toCommitFileOptions(cachedFiles)
      setHistoryFilesLoading(false)
      setHistoryFileOptions(options)
      if (commitChanged) {
        setHistoryFileIndex(0)
      } else {
        setHistoryFileIndex((current) => clampSelectionIndex(current, options.length))
      }
      return
    }

    setHistoryFilesLoading(true)
    setHistoryFileOptions([])
    setHistoryFileIndex(0)
    setHistoryDiffText("")
    setHistoryDiffMessage(`Loading files: ${commit.shortHash} ${commit.subject}`)

    const requestId = historyFilesRequestIdRef.current + 1
    historyFilesRequestIdRef.current = requestId
    let cancelled = false

    const loadCommitFiles = async () => {
      try {
        const files = await git.listCommitFiles(commit.hash)
        if (cancelled || historyFilesRequestIdRef.current !== requestId) return
        historyFilesCacheRef.current.set(commit.hash, files)
        setHistoryFileOptions(toCommitFileOptions(files))
        setHistoryFileIndex(0)
        setHistoryFilesLoading(false)
      } catch (error) {
        if (cancelled || historyFilesRequestIdRef.current !== requestId) return
        const message = error instanceof Error ? error.message : String(error)
        setHistoryFileOptions([])
        setHistoryFileIndex(0)
        setHistoryFilesLoading(false)
        setHistoryDiffText("")
        setHistoryDiffMessage(`Failed to load commit files: ${message}`)
      }
    }

    void loadCommitFiles()
    return () => {
      cancelled = true
    }
  }, [git, historyDialogOpen, selectedListCommit])

  useEffect(() => {
    if (!historyDialogOpen || !git) {
      setHistoryDiffText("")
      setHistoryDiffMessage("Select a commit to view files")
      return
    }

    const commit = selectedListCommit
    if (!commit) {
      setHistoryDiffText("")
      setHistoryDiffMessage("Select a commit to view files")
      return
    }

    if (!selectedHistoryFile) {
      if (historyFilesLoading) return
      setHistoryDiffText("")
      if (historyFileOptions.length > 0) {
        setHistoryDiffMessage("Select a file to view diff")
      } else {
        setHistoryDiffMessage(`No changed files in ${commit.shortHash} ${commit.subject}`)
      }
      return
    }

    const cacheKey = buildHistoryDiffCacheKey(commit.hash, selectedHistoryFile.path)
    const cached = historyDiffCacheRef.current.get(cacheKey)
    if (cached !== undefined) {
      setHistoryDiffText(cached)
      setHistoryDiffMessage(cached.trim() ? null : `No diff output for ${selectedHistoryFile.displayPath}`)
      return
    }

    setHistoryDiffText("")
    setHistoryDiffMessage(`Loading diff: ${selectedHistoryFile.displayPath}`)

    const requestId = historyDiffRequestIdRef.current + 1
    historyDiffRequestIdRef.current = requestId
    let cancelled = false

    const loadFileDiff = async () => {
      try {
        const nextDiff = await git.diffForCommitFile(commit.hash, selectedHistoryFile.path)
        if (cancelled || historyDiffRequestIdRef.current !== requestId) return
        historyDiffCacheRef.current.set(cacheKey, nextDiff)
        setHistoryDiffText(nextDiff)
        setHistoryDiffMessage(nextDiff.trim() ? null : `No diff output for ${selectedHistoryFile.displayPath}`)
      } catch (error) {
        if (cancelled || historyDiffRequestIdRef.current !== requestId) return
        const message = error instanceof Error ? error.message : String(error)
        setHistoryDiffText("")
        setHistoryDiffMessage(`Failed to load diff: ${message}`)
      }
    }

    void loadFileDiff()
    return () => {
      cancelled = true
    }
  }, [git, historyDialogOpen, historyFileOptions.length, historyFilesLoading, selectedHistoryFile, selectedListCommit])

  const openHistoryDialog = useCallback(async (): Promise<void> => {
    if (!git) return

    const succeeded = await runTask("LOAD HISTORY", async () => {
      const commits = await git.listCommits()
      if (commits.length === 0) {
        throw new Error("No commits found in this repository.")
      }

      const options = commits.map((commit) => ({
        name: `${commit.shortHash} ${commit.subject}`,
        description: `${commit.relativeDate} by ${commit.author}`,
        value: commit,
      }))

      historyFilesCacheRef.current.clear()
      historyDiffCacheRef.current.clear()
      previousFilesCommitHashRef.current = null
      historyFilesRequestIdRef.current += 1
      historyDiffRequestIdRef.current += 1

      setCommitOptions(options)
      setCommitIndex(0)
      setSelectedCommit(commits[0] ?? null)
      setActionIndex(0)
      setHistoryFileOptions([])
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
  }, [git, runTask, setFocus])

  const closeHistoryDialog = useCallback(() => {
    historyFilesRequestIdRef.current += 1
    historyDiffRequestIdRef.current += 1
    previousFilesCommitHashRef.current = null
    setHistoryDialogOpen(false)
    setHistoryMode("list")
    setSelectedCommit(null)
    setActionIndex(0)
    setHistoryFileOptions([])
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

  const focusHistoryCommits = useCallback(() => {
    setFocus("history-commits")
  }, [setFocus])

  const focusHistoryFiles = useCallback(() => {
    setFocus("history-files")
  }, [setFocus])

  const focusHistoryActions = useCallback(() => {
    setFocus("history-actions")
  }, [setFocus])

  const setCommitSelection = useCallback((index: number) => {
    const total = commitOptions.length
    if (total <= 0) return
    const normalized = clampSelectionIndex(index, total)
    if (normalized === commitIndex) return
    setHistoryFileOptions([])
    setHistoryFileIndex(0)
    setHistoryFilesLoading(true)
    setHistoryDiffText("")
    setHistoryDiffMessage("Loading files...")
    setCommitIndex(normalized)
  }, [commitIndex, commitOptions.length])

  const setHistoryFileSelection = useCallback((index: number) => {
    const total = historyFileOptions.length
    if (total <= 0) return
    const normalized = clampSelectionIndex(index, total)
    if (normalized === historyFileIndex) return
    setHistoryFileIndex(normalized)
  }, [historyFileIndex, historyFileOptions.length])

  const setHistoryActionSelection = useCallback((index: number) => {
    const total = ACTION_OPTIONS.length
    if (total <= 0) return
    const normalized = clampSelectionIndex(index, total)
    if (normalized === actionIndex) return
    setActionIndex(normalized)
  }, [actionIndex])

  const moveCommitSelectionUp = useCallback(() => {
    setCommitSelection(getPreviousIndex(commitIndex, commitOptions.length))
  }, [commitIndex, commitOptions.length, setCommitSelection])

  const moveCommitSelectionDown = useCallback(() => {
    setCommitSelection(getNextIndex(commitIndex, commitOptions.length))
  }, [commitIndex, commitOptions.length, setCommitSelection])

  const moveHistoryFileSelectionUp = useCallback(() => {
    setHistoryFileSelection(getPreviousIndex(historyFileIndex, historyFileOptions.length))
  }, [historyFileIndex, historyFileOptions.length, setHistoryFileSelection])

  const moveHistoryFileSelectionDown = useCallback(() => {
    setHistoryFileSelection(getNextIndex(historyFileIndex, historyFileOptions.length))
  }, [historyFileIndex, historyFileOptions.length, setHistoryFileSelection])

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

function getCommitFromOption(option: SelectOption | undefined): CommitHistoryEntry | null {
  if (!option || !option.value || typeof option.value !== "object") {
    return null
  }

  const commit = option.value as Partial<CommitHistoryEntry>
  if (!commit.hash || !commit.shortHash || !commit.subject) {
    return null
  }

  return {
    hash: commit.hash,
    shortHash: commit.shortHash,
    subject: commit.subject,
    relativeDate: commit.relativeDate ?? "",
    author: commit.author ?? "",
  }
}

function getCommitFileFromOption(option: SelectOption | undefined): CommitFileChange | null {
  if (!option || !option.value || typeof option.value !== "object") {
    return null
  }

  const file = option.value as Partial<CommitFileChange>
  if (!file.path || !file.status || !file.displayPath) {
    return null
  }

  return {
    path: file.path,
    status: file.status,
    displayPath: file.displayPath,
  }
}

function toCommitFileOptions(files: CommitFileChange[]): SelectOption[] {
  return files.map((file) => ({
    name: file.displayPath,
    description: formatCommitFileStatus(file.status),
    value: file,
  }))
}

function formatCommitFileStatus(status: string): string {
  if (status === "A") return "added"
  if (status === "C") return "copied"
  if (status === "D") return "deleted"
  if (status === "M") return "modified"
  if (status === "R") return "renamed"
  if (status === "T") return "type changed"
  return status.toLowerCase()
}

function buildHistoryDiffCacheKey(commitHash: string, path: string): string {
  return `${commitHash}\u0000${path}`
}

function clampSelectionIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(current, 0), total - 1)
}

function getNextIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current + 1) % total
}

function getPreviousIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current - 1 + total) % total
}
