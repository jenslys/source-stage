import type { RunGit } from "./types"

type RunWithTemporaryStashOptions = {
  shouldKeepStashOnError?: (error: unknown) => Promise<boolean>
}

export async function runWithStashedChanges(
  task: () => Promise<void>,
  runGit: RunGit,
): Promise<void> {
  const marker = `stage-tui-leave-${Date.now()}`
  const beforeTop = await readTopStash(runGit)

  await runGit(["stash", "push", "-u", "-m", marker])

  const afterTop = await readTopStash(runGit)
  const stashedRef =
    afterTop && afterTop.subject === marker && afterTop.ref !== beforeTop?.ref ? afterTop.ref : null

  if (!stashedRef) {
    await task()
    return
  }

  try {
    await task()
  } catch (error) {
    const restoreResult = await runGit(["stash", "pop", stashedRef], { expectedCodes: [0, 1] })
    if (restoreResult.code !== 0) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message} Also failed to restore stashed changes automatically.`, {
        cause: error,
      })
    }
    throw error
  }
}

export async function runWithTemporaryStash(
  task: () => Promise<void>,
  runGit: RunGit,
  options?: RunWithTemporaryStashOptions,
): Promise<void> {
  const marker = `stage-tui-temp-${Date.now()}`
  const beforeTop = await readTopStash(runGit)

  await runGit(["stash", "push", "-u", "-m", marker])

  const afterTop = await readTopStash(runGit)
  const stashedRef =
    afterTop && afterTop.subject === marker && afterTop.ref !== beforeTop?.ref ? afterTop.ref : null

  if (!stashedRef) {
    await task()
    return
  }

  let taskError: unknown = null
  try {
    await task()
  } catch (error) {
    taskError = error
  }

  if (taskError) {
    const shouldKeepStash = await options?.shouldKeepStashOnError?.(taskError)
    if (shouldKeepStash) {
      const message = taskError instanceof Error ? taskError.message : String(taskError)
      throw new Error(
        `${message} Local changes were stashed as ${stashedRef}; restore them after resolving or aborting the merge.`,
      )
    }
  }

  const restoreResult = await runGit(["stash", "pop", stashedRef], { expectedCodes: [0, 1] })
  if (restoreResult.code !== 0) {
    const details = restoreResult.stderr || restoreResult.stdout || "Unknown error."
    if (taskError) {
      const message = taskError instanceof Error ? taskError.message : String(taskError)
      throw new Error(`${message} Also failed to restore stashed changes: ${details}`)
    }
    throw new Error(`Task completed but failed to restore stashed changes: ${details}`)
  }

  if (taskError) {
    throw taskError
  }
}

type StashRef = {
  ref: string
  subject: string
}

async function readTopStash(runGit: RunGit): Promise<StashRef | null> {
  const result = await runGit(["stash", "list", "-n", "1", "--format=%gd%x1f%s"])
  const line = result.stdout.trim()
  if (!line) return null

  const [ref, subject] = line.split("\u001f")
  const stashRef = (ref ?? "").trim()
  if (!stashRef) return null

  return {
    ref: stashRef,
    subject: (subject ?? "").trim(),
  }
}
