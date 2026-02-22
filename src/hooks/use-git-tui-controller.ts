import type { InputRenderable, SelectOption, TextareaRenderable } from "@opentui/core"
import { useCallback, useMemo, useRef, useState } from "react"

import { GitClient, type RepoSnapshot } from "../git"
import { type FocusTarget, type TopAction } from "../ui/types"
import { buildFileRow, inferFiletype } from "../ui/utils"
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

const CREATE_BRANCH_VALUE = "__create_branch__"

export function useGitTuiController(renderer: RendererLike) {
  const branchNameRef = useRef<InputRenderable>(null)
  const summaryRef = useRef<InputRenderable>(null)
  const descriptionRef = useRef<TextareaRenderable>(null)

  const [git, setGit] = useState<GitClient | null>(null)
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [focus, setFocus] = useState<FocusTarget>("files")
  const [branchIndex, setBranchIndex] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set())

  const [summary, setSummary] = useState("")
  const [descriptionRenderKey, setDescriptionRenderKey] = useState(0)
  const [diffText, setDiffText] = useState("")
  const [diffMessage, setDiffMessage] = useState<string | null>("No file selected")
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Initializing...")

  const isBusy = busy !== null

  const branchOptions = useMemo<SelectOption[]>(
    () => [
      ...(snapshot?.branches ?? []).map((branch) => ({
        name: branch,
        description: branch === snapshot?.branch ? "Current branch" : "Checkout branch",
        value: branch,
      })),
      { name: "+ create new branch...", description: "Create and checkout", value: CREATE_BRANCH_VALUE },
    ],
    [snapshot],
  )

  const fileRows = useMemo(() => (snapshot?.files ?? []).map((file) => buildFileRow(file, excludedPaths)), [excludedPaths, snapshot])
  const branchOptionsKey = useMemo(
    () => branchOptions.map((option) => String(option.value)).join("|"),
    [branchOptions],
  )

  const selectedFile = snapshot?.files[fileIndex] ?? null
  const selectedFilePath = selectedFile?.path ?? null
  const diffFiletype = inferFiletype(selectedFile?.path)

  const refreshSnapshot = useCallback(async (): Promise<void> => {
    if (!git) return
    const next = await git.snapshot()
    setSnapshot(next)
  }, [git])

  const runTask = useCallback(
    async (label: string, task: () => Promise<void>): Promise<void> => {
      if (isBusy) return
      setBusy(label)
      setStatusMessage(`${label}...`)
      try {
        await task()
        setStatusMessage(`${label} complete`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(`Error: ${message}`)
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

  const openCreateBranchDialog = useCallback(() => {
    setCreateBranchDialogOpen(true)
    setNewBranchName("")
    setFocus("branch-create")
  }, [])

  const closeCreateBranchDialog = useCallback(() => {
    setCreateBranchDialogOpen(false)
    setNewBranchName("")
    setFocus("branch")
    if (!snapshot) return
    const currentBranchIndex = snapshot.branches.findIndex((branch) => branch === snapshot.branch)
    if (currentBranchIndex >= 0) {
      setBranchIndex(currentBranchIndex)
    }
  }, [snapshot])

  const createBranchAndCheckout = useCallback(async (): Promise<void> => {
    if (!git) return
    const branchName = branchNameRef.current?.value ?? newBranchName
    await runTask("CREATE BRANCH", async () => {
      await git.createAndCheckoutBranch(branchName)
      closeCreateBranchDialog()
      await refreshSnapshot()
    })
  }, [closeCreateBranchDialog, git, newBranchName, refreshSnapshot, runTask])

  useGitInitialization({ setGit, setFatalError, setStatusMessage })
  useGitSnapshotPolling({ git, refreshSnapshot, setStatusMessage })
  useSnapshotSelectionSync({ snapshot, fileIndex, setFileIndex, branchIndex, setBranchIndex, setExcludedPaths })
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
    createBranchDialogOpen,
    setCommitDialogOpen,
    setFocus,
    focus,
    fileCount: snapshot?.files.length ?? 0,
    moveToPreviousFile: () => setFileIndex((current) => getPreviousIndex(current, snapshot?.files.length ?? 0)),
    moveToNextFile: () => setFileIndex((current) => getNextIndex(current, snapshot?.files.length ?? 0)),
    closeCreateBranchDialog,
    commitChanges,
    createBranchAndCheckout,
    runTopAction,
    toggleSelectedFileInCommit,
  })

  const onBranchSelect = useCallback(
    (index: number, option: SelectOption | null) => {
      setBranchIndex(index)
      const optionValue = typeof option?.value === "string" ? option.value : option?.name
      if (optionValue === CREATE_BRANCH_VALUE) {
        openCreateBranchDialog()
        return
      }
      if (!git || !snapshot || !optionValue || optionValue === snapshot.branch) return
      void runTask(`CHECKOUT ${optionValue}`, async () => {
        await git.checkout(optionValue)
        await refreshSnapshot()
      })
    },
    [git, openCreateBranchDialog, refreshSnapshot, runTask, snapshot],
  )

  const topStatus = snapshot
    ? `${snapshot.branch}${snapshot.upstream ? ` -> ${snapshot.upstream}` : ""}  ahead:${snapshot.ahead} behind:${snapshot.behind}`
    : "Loading repository state..."

  return {
    summaryRef,
    descriptionRef,
    focus,
    branchNameRef,
    branchOptions,
    branchOptionsKey,
    branchIndex,
    fileRows,
    fileIndex,
    selectedFilePath,
    diffText,
    diffMessage,
    diffFiletype,
    createBranchDialogOpen,
    newBranchName,
    commitDialogOpen,
    summary,
    descriptionRenderKey,
    statusMessage,
    fatalError,
    isBusy,
    topStatus,
    onBranchChange: setBranchIndex,
    onBranchSelect,
    onBranchNameInput: setNewBranchName,
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
