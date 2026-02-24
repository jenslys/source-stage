import type { CliRenderer } from "@opentui/core"
import type { InputRenderable, SelectOption, TextareaRenderable } from "@opentui/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { generateAiCommitSummary } from "../ai-commit"
import type { StageConfig } from "../config"
import { GitClient, type RepoSnapshot } from "../git"
import { resolveTracking } from "./git-tui-controller/tracking"
import { clampSelectionIndex, getNextIndex, getPreviousIndex } from "./selection-index"
import { type FocusTarget, type TopAction } from "../ui/types"
import { buildFileRow, inferFiletype } from "../ui/utils"
import { useBranchDialogController } from "./use-branch-dialog-controller"
import { useCommitHistoryController } from "./use-commit-history-controller"
import { useTaskRunner } from "./use-task-runner"
import {
  useFileDiffLoader,
  useGitInitialization,
  useGitSnapshotPolling,
  useSnapshotSelectionSync,
} from "./use-git-tui-effects"
import { useGitTuiKeyboard } from "./use-git-tui-keyboard"

type PushSyncAction = "merge-push" | "ff-push" | "cancel"
type DiscardAction = "discard" | "cancel"
type MergeConflictAction = "complete" | "abort"

const PUSH_SYNC_OPTIONS: SelectOption[] = [
  {
    name: "update from remote, then push",
    description: "recommended. pulls new remote changes, then pushes",
    value: "merge-push",
  },
  {
    name: "push only if no merge is needed",
    description: "only works when remote has no new commits",
    value: "ff-push",
  },
  {
    name: "cancel",
    description: "do nothing",
    value: "cancel",
  },
]

const DISCARD_OPTIONS: SelectOption[] = [
  {
    name: "discard changes",
    description: "remove local edits for this file",
    value: "discard",
  },
  {
    name: "cancel",
    description: "keep the file as-is",
    value: "cancel",
  },
]

export function useGitTuiController(
  renderer: Pick<CliRenderer, "destroy" | "getSelection" | "copyToClipboardOSC52">,
  config: StageConfig,
) {
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
  const [diffMessage, setDiffMessage] = useState<string | null>("Pick a file to see changes")
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncOptionIndex, setSyncOptionIndex] = useState(0)
  const [syncDetails, setSyncDetails] = useState<string | null>(null)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [discardOptionIndex, setDiscardOptionIndex] = useState(1)
  const [discardPath, setDiscardPath] = useState<string | null>(null)
  const [mergeConflictDialogOpen, setMergeConflictDialogOpen] = useState(false)
  const [mergeConflictDetails, setMergeConflictDetails] = useState<string | null>(null)
  const [mergeConflictFilePaths, setMergeConflictFilePaths] = useState<string[]>([])
  const [mergeConflictFileIndex, setMergeConflictFileIndex] = useState(0)
  const [mergeConflictActionIndex, setMergeConflictActionIndex] = useState(0)
  const [mergeConflictStashRef, setMergeConflictStashRef] = useState<string | null>(null)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const { isBusy, statusMessage, setStatusMessage, runTask } = useTaskRunner()

  const selectedFile = snapshot?.files[fileIndex] ?? null
  const selectedFilePath = selectedFile?.path ?? null
  const diffFiletype = inferFiletype(selectedFile?.path)
  const mergeConflictFileOptions = useMemo<SelectOption[]>(
    () =>
      mergeConflictFilePaths.map((path) => ({
        name: path,
        description: "",
        value: path,
      })),
    [mergeConflictFilePaths],
  )
  const mergeConflictActionOptions = useMemo<SelectOption[]>(
    () => resolveMergeConflictActionOptions(mergeConflictFilePaths.length),
    [mergeConflictFilePaths.length],
  )
  const selectedMergeConflictPath = mergeConflictFilePaths[mergeConflictFileIndex] ?? null

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

  const activateMergeConflictDialog = useCallback(
    async ({
      details,
      stashRef,
    }: {
      details?: string | null
      stashRef?: string | null
    } = {}): Promise<boolean> => {
      if (!git) return false
      const inProgress = await git.isMergeInProgress()
      if (!inProgress) return false

      const conflictPaths = await git.listMergeConflictPaths()
      setMergeConflictFilePaths(conflictPaths)
      setMergeConflictFileIndex((current) =>
        clampSelectionIndex(current, Math.max(conflictPaths.length, 1)),
      )
      setMergeConflictActionIndex((current) =>
        clampSelectionIndex(
          current,
          resolveMergeConflictActionOptions(conflictPaths.length).length,
        ),
      )
      setMergeConflictDetails(details ?? null)
      setMergeConflictStashRef(stashRef ?? null)
      setSyncDialogOpen(false)
      setMergeConflictDialogOpen(true)
      setFocus(conflictPaths.length > 0 ? "merge-conflict-files" : "merge-conflict-actions")
      return true
    },
    [git],
  )

  const refreshMergeConflictState = useCallback(
    async (details?: string | null): Promise<void> => {
      if (!git) return
      const inProgress = await git.isMergeInProgress()
      if (!inProgress) {
        setMergeConflictDialogOpen(false)
        setMergeConflictDetails(null)
        setMergeConflictFilePaths([])
        setMergeConflictFileIndex(0)
        setMergeConflictActionIndex(0)
        setMergeConflictStashRef(null)
        setFocus("files")
        await refreshSnapshot()
        return
      }

      const conflictPaths = await git.listMergeConflictPaths()
      setMergeConflictFilePaths(conflictPaths)
      setMergeConflictFileIndex((current) =>
        clampSelectionIndex(current, Math.max(conflictPaths.length, 1)),
      )
      setMergeConflictActionIndex((current) =>
        clampSelectionIndex(
          current,
          resolveMergeConflictActionOptions(conflictPaths.length).length,
        ),
      )
      if (conflictPaths.length === 0) {
        setFocus("merge-conflict-actions")
      }
      if (details !== undefined) {
        setMergeConflictDetails(details)
      }
    },
    [git, refreshSnapshot],
  )

  const getIncludedPaths = useCallback(
    () =>
      (snapshot?.files ?? []).map((file) => file.path).filter((path) => !excludedPaths.has(path)),
    [excludedPaths, snapshot],
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
        const succeeded = await runTask("ai commit", async () => {
          const generatedSummary = await generateAiCommitSummary({
            git,
            files: snapshot?.files ?? [],
            selectedPaths: includedPaths,
            aiConfig: config.ai,
          })
          await git.commit(generatedSummary, "", Array.from(excludedPaths), includedPaths)
          setStatusMessage(`Committed: ${generatedSummary}`)
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

      if (action === "push") {
        let pushErrorMessage: string | null = null
        const succeeded = await runTask(
          "push",
          async () => {
            await git.push()
            await refreshSnapshot()
          },
          {
            onError: (error) => {
              pushErrorMessage = error.message
            },
          },
        )

        if (!succeeded && pushErrorMessage && isPushRejectedByRemoteUpdate(pushErrorMessage)) {
          setSyncDetails("Remote has new commits.")
          setSyncOptionIndex(0)
          setSyncDialogOpen(true)
          setFocus("sync-dialog-list")
        }
        return
      }

      if (action === "merge-main") {
        let mergeErrorMessage: string | null = null
        const succeeded = await runTask(
          "merge main",
          async () => {
            const target = await git.mergeRemoteMain()
            await refreshSnapshot()
            setStatusMessage(`Merged ${target}.`)
          },
          {
            onError: (error) => {
              mergeErrorMessage = error.message
            },
          },
        )
        if (!succeeded && mergeErrorMessage) {
          const opened = await activateMergeConflictDialog({
            details: "Some local and remote changes overlap.",
          })
          if (opened) {
            setStatusMessage("Merge needs attention. Fix files, then finish or cancel.")
          }
        }
        return
      }

      await runTask(action, async () => {
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
      })
    },
    [
      activateMergeConflictDialog,
      git,
      openCommitDialog,
      refreshSnapshot,
      runTask,
      setStatusMessage,
    ],
  )

  const commitChanges = useCallback(async (): Promise<void> => {
    if (!git) return
    const effectiveSummary = summaryRef.current?.value ?? summary
    const description = descriptionRef.current?.plainText ?? ""
    const includedPaths = getIncludedPaths()

    await runTask("commit", async () => {
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
  useFileDiffLoader({ git, selectedFilePath, setDiffText, setDiffMessage })

  useEffect(() => {
    if (!git) return
    let cancelled = false

    const syncMergeState = async () => {
      try {
        const inProgress = await git.isMergeInProgress()
        if (!inProgress || cancelled) return
        await activateMergeConflictDialog({
          details: "A merge is already in progress",
        })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(`Error: ${message}`)
      }
    }

    void syncMergeState()
    return () => {
      cancelled = true
    }
  }, [activateMergeConflictDialog, git, setStatusMessage])

  useEffect(() => {
    if (!git || !mergeConflictDialogOpen) return
    let active = true

    const syncConflicts = async () => {
      if (!active) return
      try {
        await refreshMergeConflictState()
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(`Error: ${message}`)
      }
    }

    void syncConflicts()
    const timer = setInterval(() => void syncConflicts(), 1200)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [git, mergeConflictDialogOpen, refreshMergeConflictState, setStatusMessage])

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

  const focusFiles = useCallback(() => {
    setFocus("files")
  }, [])

  const setMainFileSelection = useCallback(
    (index: number) => {
      const total = snapshot?.files.length ?? 0
      if (total <= 0) return
      setFileIndex(clampSelectionIndex(index, total))
    },
    [snapshot?.files.length],
  )

  const moveToPreviousMainFile = useCallback(() => {
    setFileIndex((current) => getPreviousIndex(current, snapshot?.files.length ?? 0))
  }, [snapshot?.files.length])

  const moveToNextMainFile = useCallback(() => {
    setFileIndex((current) => getNextIndex(current, snapshot?.files.length ?? 0))
  }, [snapshot?.files.length])

  const closeSyncDialog = useCallback(() => {
    setSyncDialogOpen(false)
    setSyncOptionIndex(0)
    setSyncDetails(null)
    setFocus("files")
  }, [])

  const openDiscardDialog = useCallback(() => {
    if (!selectedFilePath) {
      setStatusMessage("Pick a file first.")
      return
    }
    setDiscardPath(selectedFilePath)
    setDiscardOptionIndex(1)
    setDiscardDialogOpen(true)
    setFocus("discard-dialog-list")
  }, [selectedFilePath, setStatusMessage])

  const closeDiscardDialog = useCallback(() => {
    setDiscardDialogOpen(false)
    setDiscardOptionIndex(1)
    setDiscardPath(null)
    setFocus("files")
  }, [])

  const setDiscardSelection = useCallback((index: number) => {
    const total = DISCARD_OPTIONS.length
    if (total <= 0) return
    setDiscardOptionIndex(clampSelectionIndex(index, total))
  }, [])

  const moveDiscardSelectionUp = useCallback(() => {
    setDiscardOptionIndex((current) => getPreviousIndex(current, DISCARD_OPTIONS.length))
  }, [])

  const moveDiscardSelectionDown = useCallback(() => {
    setDiscardOptionIndex((current) => getNextIndex(current, DISCARD_OPTIONS.length))
  }, [])

  const submitDiscardAction = useCallback(async (): Promise<void> => {
    if (!git || !discardPath) {
      closeDiscardDialog()
      return
    }

    const selected = DISCARD_OPTIONS[discardOptionIndex]
    const action: DiscardAction =
      selected?.value === "discard" || selected?.value === "cancel" ? selected.value : "cancel"

    if (action === "cancel") {
      closeDiscardDialog()
      return
    }

    const succeeded = await runTask("discard changes", async () => {
      await git.discardFileChanges(discardPath)
      await refreshSnapshot()
    })

    if (succeeded) {
      setStatusMessage(`Discarded ${discardPath}`)
      closeDiscardDialog()
    }
  }, [
    closeDiscardDialog,
    discardOptionIndex,
    discardPath,
    git,
    refreshSnapshot,
    runTask,
    setStatusMessage,
  ])

  const setSyncSelection = useCallback((index: number) => {
    const total = PUSH_SYNC_OPTIONS.length
    if (total <= 0) return
    setSyncOptionIndex(clampSelectionIndex(index, total))
  }, [])

  const moveSyncSelectionUp = useCallback(() => {
    setSyncOptionIndex((current) => getPreviousIndex(current, PUSH_SYNC_OPTIONS.length))
  }, [])

  const moveSyncSelectionDown = useCallback(() => {
    setSyncOptionIndex((current) => getNextIndex(current, PUSH_SYNC_OPTIONS.length))
  }, [])

  const submitSyncAction = useCallback(async (): Promise<void> => {
    if (!git) return
    const selected = PUSH_SYNC_OPTIONS[syncOptionIndex]
    const selectedAction: PushSyncAction =
      selected?.value === "merge-push" || selected?.value === "ff-push" ? selected.value : "cancel"

    if (selectedAction === "cancel") {
      closeSyncDialog()
      return
    }

    const label = selectedAction === "merge-push" ? "MERGE + PUSH" : "FF + PUSH"
    let syncErrorMessage: string | null = null
    const succeeded = await runTask(
      label,
      async () => {
        if (selectedAction === "merge-push") {
          await git.pullMergePreservingChanges()
        } else {
          await git.pullFastForwardPreservingChanges()
        }
        await git.push()
        await refreshSnapshot()
      },
      {
        onError: (error) => {
          syncErrorMessage = error.message
          setSyncDetails(resolveSyncErrorDetails(error.message))
        },
      },
    )

    if (succeeded) {
      closeSyncDialog()
      return
    }

    if (selectedAction === "merge-push" && syncErrorMessage) {
      const opened = await activateMergeConflictDialog({
        details: "We found overlapping changes from local and remote.",
        stashRef: extractStashRef(syncErrorMessage),
      })
      if (opened) {
        setStatusMessage("Merge needs attention. Fix files, then finish or cancel.")
      }
    }
  }, [
    activateMergeConflictDialog,
    closeSyncDialog,
    git,
    refreshSnapshot,
    runTask,
    setStatusMessage,
    syncOptionIndex,
  ])

  const closeMergeConflictDialog = useCallback(() => {
    setMergeConflictDialogOpen(false)
    setMergeConflictDetails(null)
    setMergeConflictStashRef(null)
    setFocus("files")
  }, [])

  const setMergeConflictFileSelection = useCallback(
    (index: number) => {
      setMergeConflictFileIndex((current) => {
        const total = Math.max(mergeConflictFilePaths.length, 1)
        const normalized = clampSelectionIndex(index, total)
        return total > 0 ? normalized : current
      })
    },
    [mergeConflictFilePaths.length],
  )

  const setMergeConflictActionSelection = useCallback(
    (index: number) => {
      const total = mergeConflictActionOptions.length
      if (total <= 0) return
      setMergeConflictActionIndex(clampSelectionIndex(index, total))
    },
    [mergeConflictActionOptions.length],
  )

  const moveMergeConflictFileUp = useCallback(() => {
    setMergeConflictFileIndex((current) =>
      getPreviousIndex(current, Math.max(mergeConflictFilePaths.length, 1)),
    )
  }, [mergeConflictFilePaths.length])

  const moveMergeConflictFileDown = useCallback(() => {
    setMergeConflictFileIndex((current) =>
      getNextIndex(current, Math.max(mergeConflictFilePaths.length, 1)),
    )
  }, [mergeConflictFilePaths.length])

  const moveMergeConflictActionUp = useCallback(() => {
    setMergeConflictActionIndex((current) =>
      getPreviousIndex(current, mergeConflictActionOptions.length),
    )
  }, [mergeConflictActionOptions.length])

  const moveMergeConflictActionDown = useCallback(() => {
    setMergeConflictActionIndex((current) =>
      getNextIndex(current, mergeConflictActionOptions.length),
    )
  }, [mergeConflictActionOptions.length])

  const openSelectedMergeConflictFileInEditor = useCallback(async (): Promise<void> => {
    if (!git) return
    if (!selectedMergeConflictPath) {
      setStatusMessage("No conflict file selected.")
      return
    }

    const hasMarkers = await git.workingTreeFileHasConflictMarkers(selectedMergeConflictPath)
    if (!hasMarkers) {
      const succeeded = await runTask("mark resolved", async () => {
        await git.markConflictResolved(selectedMergeConflictPath)
        await refreshMergeConflictState(null)
        await refreshSnapshot()
      })
      if (succeeded) {
        setStatusMessage(`Resolved ${selectedMergeConflictPath}`)
      }
      return
    }

    const opened = await runTask("open conflict file", async () => {
      await git.openInEditor(selectedMergeConflictPath, config.editor)
    })
    if (opened) {
      setStatusMessage(`Opened ${selectedMergeConflictPath}`)
    }
  }, [
    config.editor,
    git,
    refreshMergeConflictState,
    refreshSnapshot,
    runTask,
    selectedMergeConflictPath,
    setStatusMessage,
  ])

  const restorePendingMergeStash = useCallback(async (): Promise<string | null> => {
    if (!git || !mergeConflictStashRef) return null
    try {
      await git.restoreStashRef(mergeConflictStashRef)
      setMergeConflictStashRef(null)
      return null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return message
    }
  }, [git, mergeConflictStashRef])

  const submitMergeConflictAction = useCallback(async (): Promise<void> => {
    if (!git) return
    const option = mergeConflictActionOptions[mergeConflictActionIndex]
    const selectedAction: MergeConflictAction =
      option?.value === "complete" || option?.value === "abort" ? option.value : "abort"

    if (selectedAction === "complete") {
      const succeeded = await runTask("finish merge", async () => {
        await git.completeMergeCommit()
        await refreshSnapshot()
      })
      if (succeeded) {
        const stashRestoreError = await restorePendingMergeStash()
        closeMergeConflictDialog()
        if (stashRestoreError) {
          setStatusMessage(`Merge finished. ${stashRestoreError}`)
        } else {
          setStatusMessage("Merge finished.")
        }
      } else {
        await refreshMergeConflictState(null)
      }
      return
    }

    const succeeded = await runTask("cancel merge", async () => {
      await git.abortMerge()
      await refreshSnapshot()
    })
    if (succeeded) {
      const stashRestoreError = await restorePendingMergeStash()
      closeMergeConflictDialog()
      if (stashRestoreError) {
        setStatusMessage(`Merge canceled. ${stashRestoreError}`)
      } else {
        setStatusMessage("Merge canceled.")
      }
    } else {
      await refreshMergeConflictState(null)
    }
  }, [
    closeMergeConflictDialog,
    git,
    mergeConflictActionOptions,
    mergeConflictActionIndex,
    refreshMergeConflictState,
    refreshSnapshot,
    restorePendingMergeStash,
    runTask,
    setStatusMessage,
  ])

  const openSelectedFileInEditor = useCallback(async (): Promise<void> => {
    if (!git) return
    if (!selectedFilePath) {
      setStatusMessage("Pick a file first.")
      return
    }

    const succeeded = await runTask("open file", async () => {
      await git.openInEditor(selectedFilePath, config.editor)
    })
    if (succeeded) {
      setStatusMessage(`Opened ${selectedFilePath}`)
    }
  }, [config.editor, git, runTask, selectedFilePath, setStatusMessage])

  useGitTuiKeyboard({
    renderer,
    commitDialogOpen,
    syncDialogOpen,
    discardDialogOpen,
    mergeConflictDialogOpen,
    branchDialogOpen: branchDialog.branchDialogOpen,
    branchDialogMode: branchDialog.branchDialogMode,
    historyDialogOpen: commitHistory.historyDialogOpen,
    historyDialogMode: commitHistory.historyMode,
    shortcutsDialogOpen,
    setCommitDialogOpen,
    setFocus,
    focus,
    fileCount: snapshot?.files.length ?? 0,
    mergeConflictFileCount: mergeConflictFileOptions.length,
    moveToPreviousFile: moveToPreviousMainFile,
    moveToNextFile: moveToNextMainFile,
    openBranchDialog: branchDialog.openBranchDialog,
    closeBranchDialog: branchDialog.closeBranchDialog,
    closeSyncDialog,
    closeDiscardDialog,
    closeMergeConflictDialog,
    showBranchDialogList: branchDialog.showBranchDialogList,
    submitBranchSelection: branchDialog.submitBranchSelection,
    submitBranchAction: branchDialog.submitBranchAction,
    submitBranchStrategy: branchDialog.submitBranchStrategy,
    moveBranchSelectionUp: branchDialog.moveBranchSelectionUp,
    moveBranchSelectionDown: branchDialog.moveBranchSelectionDown,
    moveBranchActionUp: branchDialog.moveBranchActionUp,
    moveBranchActionDown: branchDialog.moveBranchActionDown,
    moveSyncSelectionUp,
    moveSyncSelectionDown,
    moveBranchStrategyUp: branchDialog.moveBranchStrategyUp,
    moveBranchStrategyDown: branchDialog.moveBranchStrategyDown,
    openHistoryDialog: commitHistory.openHistoryDialog,
    closeHistoryDialog: commitHistory.closeHistoryDialog,
    backToHistoryCommitList: commitHistory.backToCommitList,
    submitHistoryCommitSelection: commitHistory.submitHistoryCommitSelection,
    submitHistoryAction: commitHistory.submitHistoryAction,
    submitSyncAction,
    submitDiscardAction,
    submitMergeConflictAction,
    openSelectedMergeConflictFileInEditor,
    moveCommitSelectionUp: commitHistory.moveCommitSelectionUp,
    moveCommitSelectionDown: commitHistory.moveCommitSelectionDown,
    moveHistoryFileSelectionUp: commitHistory.moveHistoryFileSelectionUp,
    moveHistoryFileSelectionDown: commitHistory.moveHistoryFileSelectionDown,
    moveHistoryActionUp: commitHistory.moveHistoryActionUp,
    moveHistoryActionDown: commitHistory.moveHistoryActionDown,
    moveMergeConflictFileUp,
    moveMergeConflictFileDown,
    moveDiscardSelectionUp,
    moveDiscardSelectionDown,
    moveMergeConflictActionUp,
    moveMergeConflictActionDown,
    commitChanges,
    createBranchAndCheckout: branchDialog.createBranchAndCheckout,
    openCommitDialog,
    openDiscardDialog,
    openSelectedFileInEditor,
    openShortcutsDialog: () => setShortcutsDialogOpen(true),
    closeShortcutsDialog: () => setShortcutsDialogOpen(false),
    runTopAction,
    toggleSelectedFileInCommit,
  })

  const tracking = resolveTracking(snapshot)

  return {
    summaryRef,
    descriptionRef,
    focus,
    currentBranch: snapshot?.branch ?? "...",
    branchNameRef,
    ...branchDialog,
    ...commitHistory,
    hasSnapshot: snapshot !== null,
    fileRows,
    fileIndex,
    focusFiles,
    setMainFileSelection,
    moveToPreviousMainFile,
    moveToNextMainFile,
    selectedFilePath,
    diffText,
    diffMessage,
    diffFiletype,
    commitDialogOpen,
    syncDialogOpen,
    discardDialogOpen,
    mergeConflictDialogOpen,
    syncOptions: PUSH_SYNC_OPTIONS,
    syncOptionIndex,
    syncDetails,
    setSyncSelection,
    moveSyncSelectionUp,
    moveSyncSelectionDown,
    submitSyncAction,
    closeSyncDialog,
    discardPath,
    discardOptions: DISCARD_OPTIONS,
    discardOptionIndex,
    setDiscardSelection,
    moveDiscardSelectionUp,
    moveDiscardSelectionDown,
    submitDiscardAction,
    closeDiscardDialog,
    mergeConflictDetails,
    mergeConflictFileOptions,
    mergeConflictFileIndex,
    mergeConflictActionOptions,
    mergeConflictActionIndex,
    closeMergeConflictDialog,
    setMergeConflictFileSelection,
    setMergeConflictActionSelection,
    moveMergeConflictFileUp,
    moveMergeConflictFileDown,
    moveMergeConflictActionUp,
    moveMergeConflictActionDown,
    submitMergeConflictAction,
    shortcutsDialogOpen,
    summary,
    descriptionRenderKey,
    statusMessage,
    fatalError,
    isBusy,
    tracking,
    onSummaryInput: setSummary,
  }
}

function isPushRejectedByRemoteUpdate(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("non-fast-forward") ||
    normalized.includes("fetch first") ||
    normalized.includes("failed to push some refs") ||
    normalized.includes("[rejected]")
  )
}

function resolveSyncErrorDetails(message: string): string {
  const normalized = message.toLowerCase()
  if (
    normalized.includes("non-fast-forward") ||
    normalized.includes("fetch first") ||
    normalized.includes("failed to push some refs") ||
    normalized.includes("[rejected]")
  ) {
    return "Remote has new commits."
  }

  return "Could not sync yet."
}

function extractStashRef(message: string): string | null {
  const match = message.match(/\bstashed as (\S+);/i)
  const stashRef = match?.[1]?.trim()
  return stashRef && stashRef.length > 0 ? stashRef : null
}

function resolveMergeConflictActionOptions(unresolvedConflicts: number): SelectOption[] {
  if (unresolvedConflicts > 0) {
    return [
      {
        name: "cancel merge",
        description: "go back to how things were before this merge",
        value: "abort",
      },
    ]
  }

  return [
    {
      name: "finish merge",
      description: "save this merge and continue",
      value: "complete",
    },
    {
      name: "cancel merge",
      description: "go back to how things were before this merge",
      value: "abort",
    },
  ]
}
