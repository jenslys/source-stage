export type GitCommandResult = {
  code: number
  stdout: string
  stderr: string
}

export async function runGitRaw(cwd: string, args: string[]): Promise<GitCommandResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    code,
    stdout,
    stderr,
  }
}
