import { useCallback, useRef, useState } from "react"

export type RunTask = (label: string, task: () => Promise<void>) => Promise<boolean>

export function useTaskRunner(initialStatusMessage = "Initializing...") {
  const busyRef = useRef(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState(initialStatusMessage)

  const runTask = useCallback<RunTask>(async (label, task) => {
    if (busyRef.current) {
      return false
    }

    busyRef.current = true
    setBusyLabel(label)
    setStatusMessage(`${label}...`)

    try {
      await task()
      setStatusMessage(`${label} complete`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatusMessage(`Error: ${message}`)
      return false
    } finally {
      busyRef.current = false
      setBusyLabel(null)
    }
  }, [])

  return {
    busyLabel,
    isBusy: busyLabel !== null,
    statusMessage,
    setStatusMessage,
    runTask,
  }
}
