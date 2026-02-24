import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react"

import type { CommitFileChange, CommitHistoryEntry, GitClient } from "../../git"
import { buildHistoryDiffCacheKey } from "./options"

type SetString = Dispatch<SetStateAction<string>>
type SetNullableString = Dispatch<SetStateAction<string | null>>

type UseCommitDiffLoaderParams = {
  git: GitClient | null
  historyDialogOpen: boolean
  selectedListCommit: CommitHistoryEntry | null
  selectedHistoryFile: CommitFileChange | null
  historyFilesLoading: boolean
  historyFilesCount: number
  setHistoryDiffText: SetString
  setHistoryDiffMessage: SetNullableString
  historyDiffCacheRef: MutableRefObject<Map<string, string>>
  historyDiffRequestIdRef: MutableRefObject<number>
}

export function useCommitDiffLoader({
  git,
  historyDialogOpen,
  selectedListCommit,
  selectedHistoryFile,
  historyFilesLoading,
  historyFilesCount,
  setHistoryDiffText,
  setHistoryDiffMessage,
  historyDiffCacheRef,
  historyDiffRequestIdRef,
}: UseCommitDiffLoaderParams) {
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
      if (historyFilesCount > 0) {
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
      setHistoryDiffMessage(
        cached.trim() ? null : `No diff output for ${selectedHistoryFile.displayPath}`,
      )
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
        setHistoryDiffMessage(
          nextDiff.trim() ? null : `No diff output for ${selectedHistoryFile.displayPath}`,
        )
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
  }, [
    git,
    historyDialogOpen,
    historyDiffCacheRef,
    historyDiffRequestIdRef,
    historyFilesCount,
    historyFilesLoading,
    selectedHistoryFile,
    selectedListCommit,
    setHistoryDiffMessage,
    setHistoryDiffText,
  ])
}
