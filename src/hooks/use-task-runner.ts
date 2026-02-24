import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react"

type RunTaskOptions = {
  onError?: (error: Error) => void
}

export type RunTask = (
  label: string,
  task: () => Promise<void>,
  options?: RunTaskOptions,
) => Promise<boolean>
const TASK_COMPLETE_RESET_MS = 1800

export function useTaskRunner(initialStatusMessage = "Initializing...") {
  const busyRef = useRef(false)
  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTokenRef = useRef(0)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [statusMessage, setStatusMessageState] = useState(initialStatusMessage)

  const clearStatusResetTimer = useCallback(() => {
    if (!statusResetTimerRef.current) return
    clearTimeout(statusResetTimerRef.current)
    statusResetTimerRef.current = null
  }, [])

  const setStatusMessage = useCallback(
    (message: SetStateAction<string>) => {
      clearStatusResetTimer()
      statusTokenRef.current += 1
      setStatusMessageState(message)
    },
    [clearStatusResetTimer],
  )

  const scheduleIdleStatus = useCallback(() => {
    clearStatusResetTimer()
    const token = statusTokenRef.current
    statusResetTimerRef.current = setTimeout(() => {
      if (busyRef.current) {
        return
      }
      if (token !== statusTokenRef.current) {
        return
      }
      setStatusMessageState("Ready")
      statusResetTimerRef.current = null
    }, TASK_COMPLETE_RESET_MS)
  }, [clearStatusResetTimer])

  useEffect(() => clearStatusResetTimer, [clearStatusResetTimer])

  const runTask = useCallback<RunTask>(
    async (label, task, options) => {
      if (busyRef.current) {
        return false
      }

      busyRef.current = true
      setBusyLabel(label)
      setStatusMessage(`${label}...`)

      try {
        await task()
        setStatusMessage(`${label} complete`)
        scheduleIdleStatus()
        return true
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error))
        options?.onError?.(normalizedError)
        setStatusMessage(`Error: ${normalizedError.message}`)
        return false
      } finally {
        busyRef.current = false
        setBusyLabel(null)
      }
    },
    [scheduleIdleStatus, setStatusMessage],
  )

  return {
    busyLabel,
    isBusy: busyLabel !== null,
    statusMessage,
    setStatusMessage,
    runTask,
  }
}
