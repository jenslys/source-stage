import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react"

import type { CommitFileChange, CommitHistoryEntry, GitClient } from "../../git"
import { clampSelectionIndex } from "../selection-index"

type SetBoolean = Dispatch<SetStateAction<boolean>>
type SetNumber = Dispatch<SetStateAction<number>>
type SetFiles = Dispatch<SetStateAction<CommitFileChange[]>>
type SetString = Dispatch<SetStateAction<string>>
type SetNullableString = Dispatch<SetStateAction<string | null>>

type UseCommitFilesLoaderParams = {
  git: GitClient | null
  historyDialogOpen: boolean
  selectedListCommit: CommitHistoryEntry | null
  setHistoryFilesLoading: SetBoolean
  setHistoryFiles: SetFiles
  setHistoryFileIndex: SetNumber
  setHistoryDiffText: SetString
  setHistoryDiffMessage: SetNullableString
  historyFilesCacheRef: MutableRefObject<Map<string, CommitFileChange[]>>
  previousFilesCommitHashRef: MutableRefObject<string | null>
  historyFilesRequestIdRef: MutableRefObject<number>
}

export function useCommitFilesLoader({
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
}: UseCommitFilesLoaderParams) {
  useEffect(() => {
    if (!historyDialogOpen || !git) {
      previousFilesCommitHashRef.current = null
      setHistoryFilesLoading(false)
      setHistoryFiles([])
      setHistoryFileIndex(0)
      return
    }

    const commit = selectedListCommit
    if (!commit) {
      previousFilesCommitHashRef.current = null
      setHistoryFilesLoading(false)
      setHistoryFiles([])
      setHistoryFileIndex(0)
      return
    }

    const commitChanged = previousFilesCommitHashRef.current !== commit.hash
    previousFilesCommitHashRef.current = commit.hash

    const cachedFiles = historyFilesCacheRef.current.get(commit.hash)
    if (cachedFiles) {
      setHistoryFilesLoading(false)
      setHistoryFiles(cachedFiles)
      if (commitChanged) {
        setHistoryFileIndex(0)
      } else {
        setHistoryFileIndex((current) => clampSelectionIndex(current, cachedFiles.length))
      }
      return
    }

    setHistoryFilesLoading(true)
    setHistoryFiles([])
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
        setHistoryFiles(files)
        setHistoryFileIndex(0)
        setHistoryFilesLoading(false)
      } catch (error) {
        if (cancelled || historyFilesRequestIdRef.current !== requestId) return
        const message = error instanceof Error ? error.message : String(error)
        setHistoryFiles([])
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
  }, [
    git,
    historyDialogOpen,
    historyFilesCacheRef,
    historyFilesRequestIdRef,
    previousFilesCommitHashRef,
    selectedListCommit,
    setHistoryDiffMessage,
    setHistoryDiffText,
    setHistoryFileIndex,
    setHistoryFiles,
    setHistoryFilesLoading,
  ])
}
