import { RGBA, SyntaxStyle, type InputRenderable, type SelectOption, type TextareaRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { GitClient, type RepoSnapshot } from "./git"

type FocusTarget = "branch" | "files" | "commit-summary" | "commit-description"
type TopAction = "refresh" | "fetch" | "pull" | "push" | "commit"

const MAIN_FOCUS_ORDER: FocusTarget[] = ["branch", "files"]
const COMMIT_FOCUS_ORDER: FocusTarget[] = ["commit-summary", "commit-description"]

export function App() {
  const renderer = useRenderer()
  const { width: terminalWidth } = useTerminalDimensions()
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
  const diffSyntaxStyle = useMemo(
    () =>
      SyntaxStyle.fromStyles({
        keyword: { fg: RGBA.fromHex("#c792ea"), italic: true },
        string: { fg: RGBA.fromHex("#c3e88d") },
        comment: { fg: RGBA.fromHex("#6a737d"), italic: true },
        number: { fg: RGBA.fromHex("#f78c6c") },
        function: { fg: RGBA.fromHex("#82aaff") },
        type: { fg: RGBA.fromHex("#ffcb6b") },
        variable: { fg: RGBA.fromHex("#f07178") },
        operator: { fg: RGBA.fromHex("#89ddff") },
        punctuation: { fg: RGBA.fromHex("#cdd6f4") },
        default: { fg: RGBA.fromHex("#e6edf3") },
      }),
    [],
  )

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
    const isEnter = key.name === "return" || key.name === "linefeed"

    if (commitDialogOpen && isEnter) {
      key.preventDefault()
      key.stopPropagation()
      void commitChanges()
      return
    }

    if (key.name === "escape") {
      if (commitDialogOpen) {
        setCommitDialogOpen(false)
        setFocus("files")
        return
      }
      renderer.destroy()
      return
    }

    if (key.name === "tab") {
      key.preventDefault()
      key.stopPropagation()
      const order = commitDialogOpen ? COMMIT_FOCUS_ORDER : MAIN_FOCUS_ORDER
      setFocus((current) => {
        const currentIndex = order.findIndex((item) => item === current)
        if (currentIndex < 0) return order[0] ?? "files"

        const nextIndex = key.shift
          ? (currentIndex - 1 + order.length) % order.length
          : (currentIndex + 1) % order.length
        return order[nextIndex] ?? "files"
      })
      return
    }

    if (!commitDialogOpen && key.name === "c") {
      key.preventDefault()
      key.stopPropagation()
      setCommitDialogOpen(true)
      setFocus("commit-summary")
      return
    }

    if (key.ctrl && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (key.ctrl && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (key.ctrl && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (key.ctrl && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("push")
      return
    }

    if (!commitDialogOpen && key.name === "r") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("refresh")
      return
    }
    if (!commitDialogOpen && key.name === "f") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("fetch")
      return
    }
    if (!commitDialogOpen && key.name === "l") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("pull")
      return
    }
    if (!commitDialogOpen && key.name === "p") {
      key.preventDefault()
      key.stopPropagation()
      void runTopAction("push")
      return
    }
    if (key.ctrl && key.name === "return") {
      key.preventDefault()
      key.stopPropagation()
      if (commitDialogOpen) {
        void commitChanges()
      } else {
        setCommitDialogOpen(true)
        setFocus("commit-summary")
      }
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

  const onFileSelect = useCallback((index: number) => {
    setFileIndex(index)
  }, [])

  const topStatus = snapshot
    ? `${snapshot.branch}${snapshot.upstream ? ` -> ${snapshot.upstream}` : ""}  ahead:${snapshot.ahead} behind:${snapshot.behind}`
    : "Loading repository state..."
  const footerInnerWidth = Math.max((terminalWidth ?? 0) - 2, 0)
  const footerStatusLine = fitFooterLine(statusMessage, footerInnerWidth)
  const footerHintsLine = fitFooterLine(
    `${topStatus} | tab focus | c commit | r refresh | f fetch | l pull | p push | enter commit | esc exit`,
    footerInnerWidth,
  )

  const diffFiletype = inferFiletype(selectedFile?.path)

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: "#000000",
      }}
    >
      <box style={{ height: 3, flexDirection: "row", alignItems: "center", paddingLeft: 1, paddingRight: 1, gap: 1 }}>
        <text fg="#737373">branch</text>
        <box style={{ width: 34, height: 1 }}>
          <select
            style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
            options={branchOptions}
            selectedIndex={branchIndex}
            showDescription={false}
            focused={focus === "branch"}
            selectedBackgroundColor="#111111"
            selectedTextColor="#ffffff"
            focusedBackgroundColor="#000000"
            focusedTextColor="#f3f4f6"
            onChange={setBranchIndex}
            onSelect={onBranchSelect}
          />
        </box>
        <box style={{ flexGrow: 1, justifyContent: "center" }}>
          <text fg="#525252">[r] refresh   [f] fetch   [l] pull   [p] push   [c] commit</text>
        </box>
      </box>

      <box style={{ flexDirection: "row", flexGrow: 1, gap: 1, paddingLeft: 1, paddingRight: 1 }}>
        <box style={{ width: 42, flexDirection: "column" }}>
          <text fg="#737373">changes ({fileOptions.length})</text>
          <select
            style={{ width: "100%", height: "100%", backgroundColor: "#000000", textColor: "#9ca3af" }}
            options={fileOptions}
            selectedIndex={fileIndex}
            focused={focus === "files"}
            selectedBackgroundColor="#101010"
            selectedTextColor="#f9fafb"
            focusedBackgroundColor="#000000"
            focusedTextColor="#f3f4f6"
            onChange={onFileSelect}
            onSelect={onFileSelect}
            showDescription={false}
            wrapSelection={true}
          />
        </box>
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <text fg="#737373">{selectedFile ? selectedFile.path : "no file selected"}</text>
          <diff
            diff={diffText}
            view="split"
            filetype={diffFiletype}
            syntaxStyle={diffSyntaxStyle}
            showLineNumbers={true}
            wrapMode="none"
            lineNumberFg="#525252"
            lineNumberBg="#000000"
            contextBg="#000000"
            contextContentBg="#000000"
            addedBg="#06180c"
            removedBg="#220909"
            addedContentBg="#06180c"
            removedContentBg="#220909"
            addedLineNumberBg="#0a2212"
            removedLineNumberBg="#2c1010"
            fg="#e5e7eb"
            style={{ width: "100%", height: "100%" }}
          />
        </box>
      </box>

      <box style={{ height: 2, flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
        <text fg={fatalError ? "#ff7b72" : isBusy ? "#d29922" : "#58a6ff"}>{footerStatusLine}</text>
        <text fg="#4b5563">{footerHintsLine}</text>
      </box>

      {commitDialogOpen ? (
        <box
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "#000000",
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 4,
            paddingBottom: 3,
            gap: 1,
          }}
        >
          <text fg="#f5f5f5">commit changes</text>
          <text fg="#525252">enter to commit | esc to cancel</text>
          <box
            style={{
              width: "100%",
              height: 3,
              flexDirection: "column",
              marginTop: 1,
            }}
          >
            <input
              ref={summaryRef}
              value={summary}
              onInput={setSummary}
              placeholder="summary (required)"
              focused={focus === "commit-summary"}
              backgroundColor="#000000"
              textColor="#f3f4f6"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f9fafb"
            />
          </box>
          <box style={{ width: "100%", flexGrow: 1 }}>
            <textarea
              key={descriptionRenderKey}
              ref={descriptionRef}
              initialValue=""
              placeholder="description (optional)"
              focused={focus === "commit-description"}
              backgroundColor="#000000"
              textColor="#d1d5db"
              focusedBackgroundColor="#000000"
              focusedTextColor="#f3f4f6"
            />
          </box>
        </box>
      ) : null}
    </box>
  )
}

function inferFiletype(path: string | undefined): string | undefined {
  if (!path) return undefined
  const extension = path.includes(".") ? path.split(".").pop() : undefined
  if (!extension) return undefined
  const normalized = extension.toLowerCase()

  if (normalized === "ts" || normalized === "tsx") return "typescript"
  if (normalized === "js" || normalized === "jsx" || normalized === "mjs" || normalized === "cjs") return "javascript"
  if (normalized === "md" || normalized === "mdx") return "markdown"
  if (normalized === "yml") return "yaml"
  if (normalized === "sh" || normalized === "zsh") return "bash"

  return normalized
}

function fitFooterLine(text: string, width: number): string {
  if (width <= 0) return text
  if (text.length > width) return text.slice(0, width)
  return text.padEnd(width, " ")
}
