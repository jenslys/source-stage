import { useEffect, type Dispatch, type SetStateAction } from "react"

import { GitClient, type ChangedFile, type RepoSnapshot } from "../git"

type SetGit = Dispatch<SetStateAction<GitClient | null>>
type SetString = Dispatch<SetStateAction<string>>
type SetNullableString = Dispatch<SetStateAction<string | null>>
type SetNumber = Dispatch<SetStateAction<number>>
type SetExcludedPaths = Dispatch<SetStateAction<Set<string>>>

type UseGitInitializationParams = {
  setGit: SetGit
  setFatalError: SetNullableString
  setStatusMessage: SetString
}

export function useGitInitialization({ setGit, setFatalError, setStatusMessage }: UseGitInitializationParams) {
  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      try {
        const client = await GitClient.create(process.cwd())
        if (cancelled) return
        setGit(client)
        setFatalError(null)
        setStatusMessage("Ready")
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setFatalError(message)
        setStatusMessage(`Error: ${message}`)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [setFatalError, setGit, setStatusMessage])
}

type UseGitSnapshotPollingParams = {
  git: GitClient | null
  refreshSnapshot: () => Promise<void>
  setStatusMessage: SetString
}

export function useGitSnapshotPolling({ git, refreshSnapshot, setStatusMessage }: UseGitSnapshotPollingParams) {
  useEffect(() => {
    if (!git) return
    let active = true

    const sync = async () => {
      if (!active) return
      try {
        await refreshSnapshot()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(`Error: ${message}`)
      }
    }

    void sync()
    const timer = setInterval(() => void sync(), 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [git, refreshSnapshot, setStatusMessage])
}

type UseSnapshotSelectionSyncParams = {
  snapshot: RepoSnapshot | null
  fileIndex: number
  setFileIndex: SetNumber
  setExcludedPaths: SetExcludedPaths
}

export function useSnapshotSelectionSync({
  snapshot,
  fileIndex,
  setFileIndex,
  setExcludedPaths,
}: UseSnapshotSelectionSyncParams) {
  useEffect(() => {
    if (!snapshot) return

    const knownPaths = new Set(snapshot.files.map((file) => file.path))
    setExcludedPaths((current) => {
      const next = new Set(Array.from(current).filter((path) => knownPaths.has(path)))
      return next.size === current.size ? current : next
    })

    const nextFileIndex = Math.min(fileIndex, Math.max(snapshot.files.length - 1, 0))
    if (nextFileIndex !== fileIndex) setFileIndex(nextFileIndex)
  }, [fileIndex, setExcludedPaths, setFileIndex, snapshot])
}

type UseFileDiffLoaderParams = {
  git: GitClient | null
  selectedFile: ChangedFile | null
  setDiffText: SetString
  setDiffMessage: SetNullableString
}

export function useFileDiffLoader({ git, selectedFile, setDiffText, setDiffMessage }: UseFileDiffLoaderParams) {
  useEffect(() => {
    if (!git || !selectedFile) {
      setDiffText("")
      setDiffMessage("No file selected")
      return
    }

    let cancelled = false
    setDiffText("")
    setDiffMessage(`Loading diff: ${selectedFile.path}`)

    const loadDiff = async () => {
      try {
        const nextDiff = await git.diffForFile(selectedFile.path)
        if (cancelled) return
        setDiffText(nextDiff)
        setDiffMessage(nextDiff.trim() ? null : `No diff output for ${selectedFile.path}`)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setDiffText("")
        setDiffMessage(`Failed to load diff: ${message}`)
      }
    }

    void loadDiff()
    return () => {
      cancelled = true
    }
  }, [git, selectedFile, setDiffMessage, setDiffText])
}
