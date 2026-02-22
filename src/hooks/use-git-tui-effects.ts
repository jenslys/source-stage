import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"

import { GitClient, type ChangedFile, type GitClientOptions, type RepoSnapshot } from "../git"

type SetGit = Dispatch<SetStateAction<GitClient | null>>
type SetString = Dispatch<SetStateAction<string>>
type SetNullableString = Dispatch<SetStateAction<string | null>>
type SetNumber = Dispatch<SetStateAction<number>>
type SetExcludedPaths = Dispatch<SetStateAction<Set<string>>>

type UseGitInitializationParams = {
  setGit: SetGit
  setFatalError: SetNullableString
  setStatusMessage: SetString
  gitOptions: GitClientOptions
}

export function useGitInitialization({ setGit, setFatalError, setStatusMessage, gitOptions }: UseGitInitializationParams) {
  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      try {
        const client = await GitClient.create(process.cwd(), gitOptions)
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
  }, [gitOptions, setFatalError, setGit, setStatusMessage])
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
  autoStageOnCommit: boolean
}

export function useSnapshotSelectionSync({
  snapshot,
  fileIndex,
  setFileIndex,
  setExcludedPaths,
  autoStageOnCommit,
}: UseSnapshotSelectionSyncParams) {
  const previousPathsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!snapshot) return

    const knownPaths = new Set(snapshot.files.map((file) => file.path))
    const previousPaths = previousPathsRef.current
    setExcludedPaths((current) => {
      const next = new Set(Array.from(current).filter((path) => knownPaths.has(path)))

      if (!autoStageOnCommit) {
        for (const path of knownPaths) {
          if (!previousPaths.has(path)) {
            next.add(path)
          }
        }
      }

      if (next.size === current.size && Array.from(next).every((path) => current.has(path))) {
        return current
      }
      return next
    })

    const nextFileIndex = Math.min(fileIndex, Math.max(snapshot.files.length - 1, 0))
    if (nextFileIndex !== fileIndex) setFileIndex(nextFileIndex)
    previousPathsRef.current = knownPaths
  }, [autoStageOnCommit, fileIndex, setExcludedPaths, setFileIndex, snapshot])
}

type UseFileDiffLoaderParams = {
  git: GitClient | null
  selectedFile: ChangedFile | null
  setDiffText: SetString
  setDiffMessage: SetNullableString
}

export function useFileDiffLoader({ git, selectedFile, setDiffText, setDiffMessage }: UseFileDiffLoaderParams) {
  const previousSelectedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!git || !selectedFile) {
      previousSelectedPathRef.current = null
      setDiffText("")
      setDiffMessage("No file selected")
      return
    }

    const selectedPath = selectedFile.path
    const pathChanged = previousSelectedPathRef.current !== selectedPath
    previousSelectedPathRef.current = selectedPath

    let cancelled = false
    if (pathChanged) {
      setDiffText("")
      setDiffMessage(`Loading diff: ${selectedPath}`)
    }

    const loadDiff = async () => {
      try {
        const nextDiff = await git.diffForFile(selectedPath)
        if (cancelled) return
        setDiffText(nextDiff)
        setDiffMessage(nextDiff.trim() ? null : `No diff output for ${selectedPath}`)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        if (pathChanged) {
          setDiffText("")
        }
        setDiffMessage(`Failed to load diff: ${message}`)
      }
    }

    void loadDiff()
    return () => {
      cancelled = true
    }
  }, [git, selectedFile, setDiffMessage, setDiffText])
}
