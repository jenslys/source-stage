type EditorConfig = {
  command: string
  args: string[]
}

type OpenFileInEditorParams = {
  root: string
  path: string
  line?: number
  editor: EditorConfig
}

const EDITOR_LAUNCH_TIMEOUT_MS = 1200

export async function openFileInEditor({
  root,
  path,
  line,
  editor,
}: OpenFileInEditorParams): Promise<void> {
  const command = editor.command.trim()
  if (!command) {
    throw new Error("Editor is not configured. Set [editor].command in your stage config.")
  }

  const lineNumber = Number.isFinite(line) && typeof line === "number" && line > 0 ? line : 1
  const templateArgs = editor.args.length > 0 ? editor.args : ["{file}"]
  const usesFilePlaceholder = templateArgs.some((arg) => arg.includes("{file}"))
  const args = templateArgs.map((arg) => applyEditorTemplate(arg, path, lineNumber))
  if (!usesFilePlaceholder) {
    args.push(path)
  }

  const proc = Bun.spawn([command, ...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  })

  const launchResult = await Promise.race([
    proc.exited.then(async (code) => ({
      kind: "exit" as const,
      code,
      stderr: (await new Response(proc.stderr).text()).trim(),
    })),
    wait(EDITOR_LAUNCH_TIMEOUT_MS).then(() => ({ kind: "timeout" as const })),
  ])

  if (launchResult.kind === "timeout") {
    return
  }

  if (launchResult.code !== 0) {
    const details = launchResult.stderr || `Editor command exited with code ${launchResult.code}.`
    throw new Error(details)
  }
}

function applyEditorTemplate(template: string, path: string, line: number): string {
  return template.replaceAll("{file}", path).replaceAll("{line}", String(line))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
