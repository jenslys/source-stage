import type { InputRenderable, TextareaRenderable } from "@opentui/core"
import { useCallback, useMemo, useRef, useState } from "react"

import { GitClient, type RepoSnapshot } from "../git"
import { type FocusTarget, type TopAction } from "../ui/types"
import { buildFileRow, inferFiletype } from "../ui/utils"
import { useBranchDialogController } from "./use-branch-dialog-controller"
import {
  useFileDiffLoader,
  useGitInitialization,
  useGitSnapshotPolling,
  useSnapshotSelectionSync,
} from "./use-git-tui-effects"
import { useGitTuiKeyboard } from "./use-git-tui-keyboard"

type RendererLike = {
  destroy: () => void
}

export function useGitTuiController(renderer: RendererLike) {
  const branchNameRef = useRef<InputRenderable>(null)
  const summaryRef = useRef<InputRenderable>(null)
  const descriptionRef = useRef<TextareaRenderable>(null)

  const [git, setGit] = useState<GitClient | null>(null)
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [focus, setFocus] = useState<FocusTarget>("files")
  const [fileIndex, setFileIndex] = useState(0)
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set())

  const [summary, setSummary] = useState("")
  const [descriptionRenderKey, setDescriptionRenderKey] = useState(0)
  const [diffText, setDiffText] = useState("")
  const [diffMessage, setDiffMessage] = useState<string | null>("No file selected")

  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Initializing...")

  const isBusy = busy !== null
  const selectedFile = snapshot?.files[fileIndex] ?? null
  const selectedFilePath = selectedFile?.path ?? null
  const diffFiletype = inferFiletype(selectedFile?.path)

  const fileRows = useMemo(
    () => (snapshot?.files ?? []).map((file) => buildFileRow(file, excludedPaths)),
    [excludedPaths, snapshot],
  )

  const refreshSnapshot = useCallback(async (): Promise<void> => {
    if (!git) return
    const next = await git.snapshot()
    setSnapshot(next)
  }, [git])

  const runTask = useCallback(
    async (label: string, task: () => Promise<void>): Promise<boolean> => {
      if (isBusy) return false
      setBusy(label)
      setStatusMessage(`${label}...`)
      try {
        await task()
        setStatusMessage(`${label} complete`)
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(`Error: ${message}`)
        return false
      } finally {
        setBusy(null)
      }
    },
    [isBusy],
  )

  const runTopAction = useCallback(
    async (action: TopAction): Promise<void> => {
      if (!git) return

      await runTask(action.toUpperCase(), async () => {
        if (action === "commit") {
          setCommitDialogOpen(true)
          setFocus("commit-summary")
          return
        }
        if (action === "refresh") {
          await refreshSnapshot()
          return
        }
        if (action === "fetch") {
          await git.fetch()
          await refreshSnapshot()
          return
        }
        if (action === "pull") {
          await git.pull()
          await refreshSnapshot()
          return
        }
        await git.push()
        await refreshSnapshot()
      })
    },
    [git, refreshSnapshot, runTask],
  )

  const commitChanges = useCallback(async (): Promise<void> => {
    if (!git) return
    const effectiveSummary = summaryRef.current?.value ?? summary
    const description = descriptionRef.current?.plainText ?? ""

    await runTask("COMMIT", async () => {
      await git.commit(effectiveSummary, description, Array.from(excludedPaths))
      setSummary("")
      setDescriptionRenderKey((value) => value + 1)
      setCommitDialogOpen(false)
      setFocus("files")
      setExcludedPaths(new Set())
      await refreshSnapshot()
    })
  }, [excludedPaths, git, refreshSnapshot, runTask, summary])

  const branchDialog = useBranchDialogController({
    git,
    snapshot,
    refreshSnapshot,
    runTask,
    setFocus,
    branchNameRef,
  })

  useGitInitialization({ setGit, setFatalError, setStatusMessage })
  useGitSnapshotPolling({ git, refreshSnapshot, setStatusMessage })
  useSnapshotSelectionSync({ snapshot, fileIndex, setFileIndex, setExcludedPaths })
  useFileDiffLoader({ git, selectedFile, setDiffText, setDiffMessage })

  const toggleSelectedFileInCommit = useCallback(() => {
    if (!selectedFilePath) return
    setExcludedPaths((current) => {
      const next = new Set(current)
      if (next.has(selectedFilePath)) {
        next.delete(selectedFilePath)
      } else {
        next.add(selectedFilePath)
      }
      return next
    })
  }, [selectedFilePath])

  useGitTuiKeyboard({
    renderer,
    commitDialogOpen,
    branchDialogOpen: branchDialog.branchDialogOpen,
    branchDialogMode: branchDialog.branchDialogMode,
    shortcutsDialogOpen,
    setCommitDialogOpen,
    setFocus,
    focus,
    fileCount: snapshot?.files.length ?? 0,
    moveToPreviousFile: () => setFileIndex((current) => getPreviousIndex(current, snapshot?.files.length ?? 0)),
    moveToNextFile: () => setFileIndex((current) => getNextIndex(current, snapshot?.files.length ?? 0)),
    openBranchDialog: branchDialog.openBranchDialog,
    closeBranchDialog: branchDialog.closeBranchDialog,
    showBranchDialogList: branchDialog.showBranchDialogList,
    submitBranchSelection: branchDialog.submitBranchSelection,
    submitBranchStrategy: branchDialog.submitBranchStrategy,
    commitChanges,
    createBranchAndCheckout: branchDialog.createBranchAndCheckout,
    openShortcutsDialog: () => setShortcutsDialogOpen(true),
    closeShortcutsDialog: () => setShortcutsDialogOpen(false),
    runTopAction,
    toggleSelectedFileInCommit,
  })

  const topStatus = snapshot
    ? `${snapshot.branch}${snapshot.upstream ? ` -> ${snapshot.upstream}` : ""}  ahead:${snapshot.ahead} behind:${snapshot.behind}`
    : "Loading repository state..."

  return {
    summaryRef,
    descriptionRef,
    focus,
    currentBranch: snapshot?.branch ?? "...",
    branchNameRef,
    ...branchDialog,
    fileRows,
    fileIndex,
    selectedFilePath,
    diffText,
    diffMessage,
    diffFiletype,
    commitDialogOpen,
    shortcutsDialogOpen,
    summary,
    descriptionRenderKey,
    statusMessage,
    fatalError,
    isBusy,
    topStatus,
    onSummaryInput: setSummary,
  }
}

function getNextIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current + 1) % total
}

function getPreviousIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current - 1 + total) % total
}
