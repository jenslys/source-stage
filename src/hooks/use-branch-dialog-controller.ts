import type { InputRenderable, SelectOption } from "@opentui/core"
import { useCallback, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from "react"

import type { GitClient, RepoSnapshot } from "../git"
import type { FocusTarget } from "../ui/types"

type BranchDialogMode = "select" | "create" | "confirm"
type BranchChangeStrategy = "bring" | "leave"
type PendingBranchAction =
  | { kind: "checkout"; branch: string }
  | { kind: "create"; branchName: string }

type RunTask = (label: string, task: () => Promise<void>) => Promise<boolean>

type UseBranchDialogControllerParams = {
  git: GitClient | null
  snapshot: RepoSnapshot | null
  refreshSnapshot: () => Promise<void>
  runTask: RunTask
  setFocus: Dispatch<SetStateAction<FocusTarget>>
  branchNameRef: RefObject<InputRenderable | null>
}

const CREATE_BRANCH_VALUE = "__create_branch__"
const BRANCH_STRATEGY_OPTIONS: SelectOption[] = [
  { name: "bring working changes", description: "Carry local changes onto the new branch", value: "bring" },
  { name: "leave changes on current branch", description: "Stash changes and switch cleanly", value: "leave" },
]

export function useBranchDialogController({
  git,
  snapshot,
  refreshSnapshot,
  runTask,
  setFocus,
  branchNameRef,
}: UseBranchDialogControllerParams) {
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [branchDialogMode, setBranchDialogMode] = useState<BranchDialogMode>("select")
  const [branchIndex, setBranchIndex] = useState(0)
  const [branchStrategyIndex, setBranchStrategyIndex] = useState(0)
  const [pendingBranchAction, setPendingBranchAction] = useState<PendingBranchAction | null>(null)
  const [newBranchName, setNewBranchName] = useState("")

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

  const branchOptionsKey = useMemo(
    () => branchOptions.map((option) => String(option.value)).join("|"),
    [branchOptions],
  )

  const openBranchDialog = useCallback(() => {
    setBranchDialogOpen(true)
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setNewBranchName("")
    setBranchStrategyIndex(0)
    setFocus("branch-dialog-list")

    const currentBranchIndex = snapshot?.branches.findIndex((branch) => branch === snapshot.branch) ?? -1
    setBranchIndex(currentBranchIndex >= 0 ? currentBranchIndex : 0)
  }, [setFocus, snapshot])

  const closeBranchDialog = useCallback(() => {
    setBranchDialogOpen(false)
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setBranchStrategyIndex(0)
    setNewBranchName("")
    setFocus("files")
  }, [setFocus])

  const showBranchCreateInput = useCallback(() => {
    setBranchDialogMode("create")
    setPendingBranchAction(null)
    setBranchStrategyIndex(0)
    setNewBranchName("")
    setFocus("branch-create")
  }, [setFocus])

  const showBranchDialogList = useCallback(() => {
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setBranchStrategyIndex(0)
    setFocus("branch-dialog-list")
    setNewBranchName("")
  }, [setFocus])

  const performBranchTransition = useCallback(
    async (action: PendingBranchAction, strategy: BranchChangeStrategy): Promise<void> => {
      if (!git) return
      const labelTarget = action.kind === "checkout" ? action.branch : action.branchName
      const label = `${action.kind === "checkout" ? "CHECKOUT" : "CREATE BRANCH"} ${labelTarget} (${strategy})`
      const succeeded = await runTask(label, async () => {
        if (action.kind === "checkout") {
          if (strategy === "leave") {
            await git.checkoutLeavingChanges(action.branch)
          } else {
            await git.checkout(action.branch)
          }
        } else if (strategy === "leave") {
          await git.createAndCheckoutBranchLeavingChanges(action.branchName)
        } else {
          await git.createAndCheckoutBranch(action.branchName)
        }
        await refreshSnapshot()
      })

      if (succeeded) {
        closeBranchDialog()
      }
    },
    [closeBranchDialog, git, refreshSnapshot, runTask],
  )

  const requestBranchTransition = useCallback(
    async (action: PendingBranchAction): Promise<void> => {
      if ((snapshot?.files.length ?? 0) > 0) {
        setPendingBranchAction(action)
        setBranchStrategyIndex(0)
        setBranchDialogMode("confirm")
        setFocus("branch-dialog-list")
        return
      }
      await performBranchTransition(action, "bring")
    },
    [performBranchTransition, setFocus, snapshot],
  )

  const submitBranchSelection = useCallback(async (): Promise<void> => {
    if (!snapshot) return
    const selected = branchOptions[branchIndex]
    const optionValue = typeof selected?.value === "string" ? selected.value : selected?.name
    if (!optionValue) return

    if (optionValue === CREATE_BRANCH_VALUE) {
      showBranchCreateInput()
      return
    }
    if (optionValue === snapshot.branch) {
      closeBranchDialog()
      return
    }
    await requestBranchTransition({ kind: "checkout", branch: optionValue })
  }, [branchIndex, branchOptions, closeBranchDialog, requestBranchTransition, showBranchCreateInput, snapshot])

  const createBranchAndCheckout = useCallback(async (): Promise<void> => {
    const branchName = branchNameRef.current?.value ?? newBranchName
    await requestBranchTransition({ kind: "create", branchName })
  }, [branchNameRef, newBranchName, requestBranchTransition])

  const submitBranchStrategy = useCallback(async (): Promise<void> => {
    if (!pendingBranchAction) return
    const selectedOption = BRANCH_STRATEGY_OPTIONS[branchStrategyIndex]
    const selectedValue = selectedOption?.value === "leave" ? "leave" : "bring"
    await performBranchTransition(pendingBranchAction, selectedValue)
  }, [branchStrategyIndex, pendingBranchAction, performBranchTransition])

  return {
    branchDialogOpen,
    branchDialogMode,
    branchOptions,
    branchOptionsKey,
    branchIndex,
    branchStrategyOptions: BRANCH_STRATEGY_OPTIONS,
    branchStrategyIndex,
    newBranchName,
    openBranchDialog,
    closeBranchDialog,
    showBranchDialogList,
    submitBranchSelection,
    submitBranchStrategy,
    createBranchAndCheckout,
    onBranchDialogChange: setBranchIndex,
    onBranchStrategyChange: setBranchStrategyIndex,
    onBranchNameInput: setNewBranchName,
  }
}
