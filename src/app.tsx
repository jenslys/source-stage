import type { SelectOption, TabSelectOption, TextareaRenderable } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { GitClient, type RepoSnapshot } from "./git"

type FocusTarget = "actions" | "branch" | "files" | "summary" | "description"
type TopAction = "refresh" | "fetch" | "pull" | "push"

const FOCUS_ORDER: FocusTarget[] = ["actions", "branch", "files", "summary", "description"]

const ACTION_OPTIONS: TabSelectOption[] = [
  { name: "Refresh", description: "Reload git status", value: "refresh" satisfies TopAction },
  { name: "Fetch", description: "Fetch origin", value: "fetch" satisfies TopAction },
  { name: "Pull", description: "Pull --ff-only", value: "pull" satisfies TopAction },
  { name: "Push", description: "Push current branch", value: "push" satisfies TopAction },
]

export function App() {
  const renderer = useRenderer()
  const descriptionRef = useRef<TextareaRenderable>(null)

  const [git, setGit] = useState<GitClient | null>(null)
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [focus, setFocus] = useState<FocusTarget>("files")
  const [actionIndex, setActionIndex] = useState(0)
  const [branchIndex, setBranchIndex] = useState(0)
  const [fileIndex, setFileIndex] = useState(0)

  const [summary, setSummary] = useState("")
  const [descriptionRenderKey, setDescriptionRenderKey] = useState(0)
  const [diffText, setDiffText] = useState("# No file selected")

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
        name: file.path,
        description: `${file.indexStatus}${file.worktreeStatus} ${file.statusLabel}`,
        value: file.path,
      })),
    [snapshot],
  )

  const selectedFile = snapshot?.files[fileIndex] ?? null

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
    const description = descriptionRef.current?.plainText ?? ""

    await runTask("COMMIT", async () => {
      await git.commit(summary, description)
      setSummary("")
      setDescriptionRenderKey((value) => value + 1)
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
    const timer = setInterval(() => {
      void sync()
    }, 4000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [git, refreshSnapshot])

  useEffect(() => {
    if (!snapshot) return

    const nextFileIndex = Math.min(fileIndex, Math.max(snapshot.files.length - 1, 0))
    if (nextFileIndex !== fileIndex) {
      setFileIndex(nextFileIndex)
    }

    const currentBranchIndex = snapshot.branches.findIndex((branch) => branch === snapshot.branch)
    if (currentBranchIndex >= 0 && currentBranchIndex !== branchIndex) {
      setBranchIndex(currentBranchIndex)
    }
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

  useKeyboard((key) => {
    if (key.name === "escape") {
      renderer.destroy()
      return
    }

    if (key.name === "tab") {
      setFocus((current) => {
        const currentIndex = FOCUS_ORDER.findIndex((item) => item === current)
        if (currentIndex < 0) return "files"

        const nextIndex = key.shift
          ? (currentIndex - 1 + FOCUS_ORDER.length) % FOCUS_ORDER.length
          : (currentIndex + 1) % FOCUS_ORDER.length
        return FOCUS_ORDER[nextIndex] ?? "files"
      })
      return
    }

    if (key.ctrl && key.name === "r") {
      void runTopAction("refresh")
      return
    }
    if (key.ctrl && key.name === "f") {
      void runTopAction("fetch")
      return
    }
    if (key.ctrl && key.name === "l") {
      void runTopAction("pull")
      return
    }
    if (key.ctrl && key.name === "p") {
      void runTopAction("push")
      return
    }
    if (key.ctrl && key.name === "return") {
      void commitChanges()
    }
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

  const onActionSelect = useCallback(
    (index: number, option: TabSelectOption | null) => {
      setActionIndex(index)
      if (!option?.value) return
      void runTopAction(option.value as TopAction)
    },
    [runTopAction],
  )

  const onFileSelect = useCallback((index: number) => {
    setFileIndex(index)
  }, [])

  const topStatus = snapshot
    ? `${snapshot.branch}${snapshot.upstream ? ` -> ${snapshot.upstream}` : ""}  ahead:${snapshot.ahead} behind:${snapshot.behind}`
    : "Loading repository state..."

  const diffFiletype = inferFiletype(selectedFile?.path)

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: "#0d1117",
      }}
    >
      <box title="Git Controls" style={{ border: true, height: 6, flexDirection: "row", gap: 1, padding: 1 }}>
        <box title="Branch" style={{ border: true, width: 40 }}>
          <select
            options={branchOptions}
            selectedIndex={branchIndex}
            showDescription={false}
            focused={focus === "branch"}
            onChange={setBranchIndex}
            onSelect={onBranchSelect}
          />
        </box>
        <box title="Actions" style={{ border: true, flexGrow: 1 }}>
          <tab-select
            options={ACTION_OPTIONS}
            selectedIndex={actionIndex}
            showDescription={false}
            focused={focus === "actions"}
            onChange={setActionIndex}
            onSelect={onActionSelect}
          />
        </box>
      </box>

      <box style={{ flexDirection: "row", flexGrow: 1, gap: 1, padding: 1 }}>
        <box title={`Changes (${fileOptions.length})`} style={{ border: true, width: 45 }}>
          <select
            options={fileOptions}
            selectedIndex={fileIndex}
            focused={focus === "files"}
            onChange={onFileSelect}
            onSelect={onFileSelect}
            showDescription={true}
            wrapSelection={true}
          />
        </box>
        <box title={selectedFile ? `Diff: ${selectedFile.path}` : "Diff"} style={{ border: true, flexGrow: 1 }}>
          <diff diff={diffText} view="unified" filetype={diffFiletype} showLineNumbers={true} wrapMode="none" />
        </box>
      </box>

      <box title="Commit" style={{ border: true, height: 9, flexDirection: "column", gap: 1, padding: 1 }}>
        <box title="Summary" style={{ border: true, height: 3 }}>
          <input
            value={summary}
            onInput={setSummary}
            onSubmit={() => {
              void commitChanges()
            }}
            placeholder="Commit summary"
            focused={focus === "summary"}
          />
        </box>
        <box title="Description" style={{ border: true, height: 3 }}>
          <textarea
            key={descriptionRenderKey}
            ref={descriptionRef}
            initialValue=""
            placeholder="Optional commit description"
            focused={focus === "description"}
          />
        </box>
      </box>

      <box style={{ height: 3, border: true, padding: 1, flexDirection: "column" }}>
        <text fg={fatalError ? "#ff7b72" : isBusy ? "#d29922" : "#58a6ff"}>{statusMessage}</text>
        <text fg="#8b949e">
          {topStatus} | TAB focus | CTRL+R refresh | CTRL+F fetch | CTRL+L pull | CTRL+P push | CTRL+ENTER commit |
          ESC exit
        </text>
      </box>
    </box>
  )
}

function inferFiletype(path: string | undefined): string | undefined {
  if (!path) return undefined
  const extension = path.includes(".") ? path.split(".").pop() : undefined
  if (!extension) return undefined
  return extension.toLowerCase()
}
