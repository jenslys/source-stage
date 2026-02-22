import type { InputRenderable, TextareaRenderable } from "@opentui/core"
import { useCallback, useMemo, useRef, useState } from "react"

import { generateAiCommitSummary } from "../ai-commit"
import type { StageConfig } from "../config"
import { GitClient, type RepoSnapshot } from "../git"
import { type FocusTarget, type TopAction } from "../ui/types"
import { buildFileRow, formatTrackingSummary, inferFiletype } from "../ui/utils"
import { useBranchDialogController } from "./use-branch-dialog-controller"
import { useCommitHistoryController } from "./use-commit-history-controller"
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

export function useGitTuiController(renderer: RendererLike, config: StageConfig) {
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
  const gitOptions = useMemo(
    () => ({
      hideWhitespaceChanges: config.ui.hideWhitespaceChanges,
      historyLimit: config.history.limit,
      autoStageOnCommit: config.git.autoStageOnCommit,
    }),
    [config.git.autoStageOnCommit, config.history.limit, config.ui.hideWhitespaceChanges],
  )

  const refreshSnapshot = useCallback(async (): Promise<void> => {
    if (!git) return
    const next = await git.snapshot()
    setSnapshot(next)
  }, [git])

  const getIncludedPaths = useCallback(
    () =>
      (snapshot?.files ?? [])
        .map((file) => file.path)
        .filter((path) => !excludedPaths.has(path)),
    [excludedPaths, snapshot],
  )

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

  const openCommitDialog = useCallback(() => {
    if (!git) {
      setStatusMessage("Repository not ready.")
      return
    }
    if ((snapshot?.files.length ?? 0) === 0) {
      setStatusMessage("No working changes to commit.")
      return
    }
    if (config.ai.enabled) {
      const includedPaths = getIncludedPaths()
      if (includedPaths.length === 0) {
        setStatusMessage("No files selected for commit.")
        return
      }

      void (async () => {
        const succeeded = await runTask("AI COMMIT", async () => {
          const summary = await generateAiCommitSummary({
            git,
            files: snapshot?.files ?? [],
            selectedPaths: includedPaths,
            aiConfig: config.ai,
          })
          await git.commit(summary, "", Array.from(excludedPaths), includedPaths)
          setStatusMessage(`Committed: ${summary}`)
          setSummary("")
          setDescriptionRenderKey((value) => value + 1)
          setCommitDialogOpen(false)
          setFocus("files")
          setExcludedPaths(new Set())
          await refreshSnapshot()
        })

        if (!succeeded) {
          setCommitDialogOpen(true)
          setFocus("commit-summary")
        }
      })()
      return
    }
    setCommitDialogOpen(true)
    setFocus("commit-summary")
  }, [config.ai, excludedPaths, getIncludedPaths, git, refreshSnapshot, runTask, snapshot])

  const runTopAction = useCallback(
    async (action: TopAction): Promise<void> => {
      if (!git) return

      if (action === "commit") {
        openCommitDialog()
        return
      }

      await runTask(action.toUpperCase(), async () => {
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
    [git, openCommitDialog, refreshSnapshot, runTask],
  )

  const commitChanges = useCallback(async (): Promise<void> => {
    if (!git) return
    const effectiveSummary = summaryRef.current?.value ?? summary
    const description = descriptionRef.current?.plainText ?? ""
    const includedPaths = getIncludedPaths()

    await runTask("COMMIT", async () => {
      await git.commit(effectiveSummary, description, Array.from(excludedPaths), includedPaths)
      setSummary("")
      setDescriptionRenderKey((value) => value + 1)
      setCommitDialogOpen(false)
      setFocus("files")
      setExcludedPaths(new Set())
      await refreshSnapshot()
    })
  }, [excludedPaths, getIncludedPaths, git, refreshSnapshot, runTask, summary])

  const branchDialog = useBranchDialogController({
    git,
    snapshot,
    refreshSnapshot,
    runTask,
    setFocus,
    branchNameRef,
  })
  const commitHistory = useCommitHistoryController({
    git,
    refreshSnapshot,
    runTask,
    setFocus,
  })

  useGitInitialization({ setGit, setFatalError, setStatusMessage, gitOptions })
  useGitSnapshotPolling({ git, refreshSnapshot, setStatusMessage })
  useSnapshotSelectionSync({
    snapshot,
    fileIndex,
    setFileIndex,
    setExcludedPaths,
    autoStageOnCommit: config.git.autoStageOnCommit,
  })
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
    historyDialogOpen: commitHistory.historyDialogOpen,
    historyDialogMode: commitHistory.historyMode,
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
    openHistoryDialog: commitHistory.openHistoryDialog,
    closeHistoryDialog: commitHistory.closeHistoryDialog,
    backToHistoryCommitList: commitHistory.backToCommitList,
    submitHistoryCommitSelection: commitHistory.submitHistoryCommitSelection,
    submitHistoryAction: commitHistory.submitHistoryAction,
    commitChanges,
    createBranchAndCheckout: branchDialog.createBranchAndCheckout,
    openCommitDialog,
    openShortcutsDialog: () => setShortcutsDialogOpen(true),
    closeShortcutsDialog: () => setShortcutsDialogOpen(false),
    runTopAction,
    toggleSelectedFileInCommit,
  })

  const topStatus = snapshot
    ? `⎇ ${snapshot.branch}${snapshot.upstream ? ` ⇄ ${snapshot.upstream}` : ""}  ${formatTrackingSummary(snapshot.upstream, snapshot.ahead, snapshot.behind)}`
    : "… loading repository state"

  return {
    summaryRef,
    descriptionRef,
    focus,
    currentBranch: snapshot?.branch ?? "...",
    branchNameRef,
    ...branchDialog,
    ...commitHistory,
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
