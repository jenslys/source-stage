export type GitCommandResult = {
  code: number
  stdout: string
  stderr: string
}

type RunGitRawOptions = {
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 120_000

export async function runGitRaw(
  cwd: string,
  args: string[],
  options?: RunGitRawOptions,
): Promise<GitCommandResult> {
  let timedOut = false
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_EDITOR: "true",
      GIT_SEQUENCE_EDITOR: "true",
      GIT_PAGER: "cat",
    },
  })

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeout = setTimeout(() => {
    timedOut = true
    proc.kill()
  }, timeoutMs)

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeout)

  if (timedOut) {
    return {
      code: 124,
      stdout,
      stderr: stderr || `git ${args.join(" ")} timed out after ${timeoutMs}ms.`,
    }
  }

  return {
    code,
    stdout,
    stderr,
  }
}
