import type { InputRenderable, SelectOption, TextareaRenderable } from "@opentui/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { GitClient, type RepoSnapshot } from "../git"
import { type FocusTarget, type TopAction } from "../ui/types"
import { inferFiletype } from "../ui/utils"
import { useGitTuiKeyboard } from "./use-git-tui-keyboard"

type RendererLike = {
  destroy: () => void
}

export function useGitTuiController(renderer: RendererLike) {
  const summaryRef = useRef<InputRenderable>(null)
  const descriptionRef = useRef<TextareaRenderable>(null)

  const [git, setGit] = useState<GitClient | null>(null)
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [focus, setFocus] = useState<FocusTarget>("files")
  const [branchIndex, setBranchIndex] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)

  const [summary, setSummary] = useState("")
  const [descriptionRenderKey, setDescriptionRenderKey] = useState(0)
  const [diffText, setDiffText] = useState("# No file selected")
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Initializing...")

  const isBusy = busy !== null

  const branchOptions = useMemo<SelectOption[]>(
    () =>
      (snapshot?.branches ?? []).map((branch) => ({
        name: branch,
        description: branch === snapshot?.branch ? "Current branch" : "Checkout branch",
        value: branch,
      })),
    [snapshot],
  )

  const fileOptions = useMemo<SelectOption[]>(
    () =>
      (snapshot?.files ?? []).map((file) => ({
        name: `${file.indexStatus}${file.worktreeStatus} ${file.path}`,
        description: file.statusLabel,
        value: file.path,
      })),
    [snapshot],
  )

  const selectedFile = snapshot?.files[fileIndex] ?? null
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
      await git.commit(effectiveSummary, description)
      setSummary("")
      setDescriptionRenderKey((value) => value + 1)
      setCommitDialogOpen(false)
      setFocus("files")
      await refreshSnapshot()
    })
  }, [git, refreshSnapshot, runTask, summary])

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
  }, [])

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
  }, [git, refreshSnapshot])

  useEffect(() => {
    if (!snapshot) return

    const nextFileIndex = Math.min(fileIndex, Math.max(snapshot.files.length - 1, 0))
    if (nextFileIndex !== fileIndex) setFileIndex(nextFileIndex)

    const nextBranchIndex = snapshot.branches.findIndex((branch) => branch === snapshot.branch)
    if (nextBranchIndex >= 0 && nextBranchIndex !== branchIndex) setBranchIndex(nextBranchIndex)
  }, [branchIndex, fileIndex, snapshot])

  useEffect(() => {
    if (!git || !selectedFile) {
      setDiffText("# No file selected")
      return
    }

    let cancelled = false
    setDiffText(`# Loading diff: ${selectedFile.path}`)

    const loadDiff = async () => {
      try {
        const nextDiff = await git.diffForFile(selectedFile.path)
        if (cancelled) return
        setDiffText(nextDiff || `# No diff output for ${selectedFile.path}`)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setDiffText(`# Failed to load diff\n${message}`)
      }
    }

    void loadDiff()
    return () => {
      cancelled = true
    }
  }, [git, selectedFile])

  useGitTuiKeyboard({
    renderer,
    commitDialogOpen,
    setCommitDialogOpen,
    setFocus,
    commitChanges,
    runTopAction,
  })

  const onBranchSelect = useCallback(
    (index: number, option: SelectOption | null) => {
      setBranchIndex(index)
      if (!git || !snapshot || !option?.name || option.name === snapshot.branch) return
      void runTask(`CHECKOUT ${option.name}`, async () => {
        await git.checkout(option.name)
        await refreshSnapshot()
      })
    },
    [git, refreshSnapshot, runTask, snapshot],
  )

  const onFileSelect = useCallback((index: number) => setFileIndex(index), [])

  const topStatus = snapshot
    ? `${snapshot.branch}${snapshot.upstream ? ` -> ${snapshot.upstream}` : ""}  ahead:${snapshot.ahead} behind:${snapshot.behind}`
    : "Loading repository state..."

  return {
    summaryRef,
    descriptionRef,
    focus,
    branchOptions,
    branchIndex,
    fileOptions,
    fileIndex,
    selectedFilePath: selectedFile?.path ?? null,
    diffText,
    diffFiletype,
    commitDialogOpen,
    summary,
    descriptionRenderKey,
    statusMessage,
    fatalError,
    isBusy,
    topStatus,
    onBranchChange: setBranchIndex,
    onBranchSelect,
    onFileSelect,
    onSummaryInput: setSummary,
  }
}
