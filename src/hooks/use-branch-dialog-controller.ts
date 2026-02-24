import type { InputRenderable, SelectOption } from "@opentui/core"
import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"

import type { GitClient, RepoSnapshot } from "../git"
import { clampSelectionIndex, getNextIndex, getPreviousIndex } from "./selection-index"
import type { RunTask } from "./use-task-runner"
import type { BranchDialogMode, FocusTarget } from "../ui/types"

type BranchChangeStrategy = "bring" | "leave"
type PendingBranchAction =
  | { kind: "checkout"; branch: string }
  | { kind: "create"; branchName: string }
type BranchActionOptionValue = "checkout" | "delete-local" | "delete-remote" | "cancel"

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
  {
    name: "keep my changes",
    description: "switch branches and keep current file changes",
    value: "bring",
  },
  {
    name: "switch clean",
    description: "switch branches without current file changes",
    value: "leave",
  },
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
  const [branchActionIndex, setBranchActionIndex] = useState(0)
  const [branchStrategyIndex, setBranchStrategyIndex] = useState(0)
  const [pendingBranchAction, setPendingBranchAction] = useState<PendingBranchAction | null>(null)
  const [selectedBranchForAction, setSelectedBranchForAction] = useState<string | null>(null)
  const [newBranchName, setNewBranchName] = useState("")
  const branchNames = snapshot?.branches ?? []

  const branchOptions = useMemo<SelectOption[]>(
    () => [
      { name: "+ create new branch...", description: "", value: CREATE_BRANCH_VALUE },
      ...branchNames.map((branch) => ({
        name: branch,
        description: branch === snapshot?.branch ? "current" : "",
        value: branch,
      })),
    ],
    [branchNames, snapshot?.branch],
  )
  const branchActionOptions = useMemo<SelectOption[]>(() => {
    const branch = selectedBranchForAction?.trim()
    if (!branch) return []
    const isCurrentBranch = branch === snapshot?.branch
    const options: SelectOption[] = [
      {
        name: "checkout",
        description: isCurrentBranch ? "you are already here" : "switch to this branch",
        value: "checkout",
      },
    ]
    if (!isCurrentBranch) {
      options.push({
        name: "delete local",
        description: "remove this branch from this machine",
        value: "delete-local",
      })
    }
    options.push(
      {
        name: "delete remote",
        description: "remove this branch from origin",
        value: "delete-remote",
      },
      {
        name: "back",
        description: "go back to branch list",
        value: "cancel",
      },
    )
    return options
  }, [selectedBranchForAction, snapshot?.branch])

  const openBranchDialog = useCallback(() => {
    setBranchDialogOpen(true)
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setSelectedBranchForAction(null)
    setBranchActionIndex(0)
    setNewBranchName("")
    setBranchStrategyIndex(0)
    setFocus("branch-dialog-list")

    const currentBranchIndex = branchNames.findIndex((branch) => branch === snapshot?.branch)
    if (currentBranchIndex >= 0) {
      setBranchIndex(currentBranchIndex + 1)
      return
    }
    setBranchIndex(branchOptions.length > 1 ? 1 : 0)
  }, [branchNames, branchOptions.length, setFocus, snapshot?.branch])

  const closeBranchDialog = useCallback(() => {
    setBranchDialogOpen(false)
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setSelectedBranchForAction(null)
    setBranchActionIndex(0)
    setBranchStrategyIndex(0)
    setNewBranchName("")
    setFocus("files")
  }, [setFocus])

  const showBranchCreateInput = useCallback(() => {
    setBranchDialogMode("create")
    setPendingBranchAction(null)
    setSelectedBranchForAction(null)
    setBranchActionIndex(0)
    setBranchStrategyIndex(0)
    setNewBranchName("")
    setFocus("branch-create")
  }, [setFocus])

  const showBranchDialogList = useCallback(() => {
    setBranchDialogMode("select")
    setPendingBranchAction(null)
    setSelectedBranchForAction(null)
    setBranchActionIndex(0)
    setBranchStrategyIndex(0)
    setFocus("branch-dialog-list")
    setNewBranchName("")
  }, [setFocus])

  const showBranchActionList = useCallback(
    (branch: string) => {
      setSelectedBranchForAction(branch)
      setBranchActionIndex(0)
      setBranchDialogMode("action")
      setFocus("branch-dialog-list")
    },
    [setFocus],
  )

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
    showBranchActionList(optionValue)
  }, [branchIndex, branchOptions, showBranchActionList, showBranchCreateInput])

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

  const submitBranchAction = useCallback(async (): Promise<void> => {
    if (!git || !selectedBranchForAction) return
    const selected = branchActionOptions[branchActionIndex]
    const action: BranchActionOptionValue =
      selected?.value === "checkout" ||
      selected?.value === "delete-local" ||
      selected?.value === "delete-remote" ||
      selected?.value === "cancel"
        ? selected.value
        : "cancel"

    if (action === "cancel") {
      showBranchDialogList()
      return
    }

    if (action === "checkout") {
      if (selectedBranchForAction === snapshot?.branch) {
        closeBranchDialog()
        return
      }
      await requestBranchTransition({ kind: "checkout", branch: selectedBranchForAction })
      return
    }

    const label =
      action === "delete-local"
        ? `DELETE LOCAL ${selectedBranchForAction}`
        : `DELETE REMOTE ${selectedBranchForAction}`
    const succeeded = await runTask(label, async () => {
      if (action === "delete-local") {
        await git.deleteLocalBranch(selectedBranchForAction)
      } else {
        await git.deleteRemoteBranch(selectedBranchForAction)
      }
      await refreshSnapshot()
    })

    if (succeeded) {
      showBranchDialogList()
    }
  }, [
    branchActionIndex,
    branchActionOptions,
    closeBranchDialog,
    git,
    refreshSnapshot,
    requestBranchTransition,
    runTask,
    selectedBranchForAction,
    showBranchDialogList,
    snapshot?.branch,
  ])

  const moveBranchSelectionUp = useCallback(() => {
    setBranchIndex((current) => getPreviousIndex(current, branchOptions.length))
  }, [branchOptions.length])

  const moveBranchSelectionDown = useCallback(() => {
    setBranchIndex((current) => getNextIndex(current, branchOptions.length))
  }, [branchOptions.length])

  const moveBranchStrategyUp = useCallback(() => {
    setBranchStrategyIndex((current) => getPreviousIndex(current, BRANCH_STRATEGY_OPTIONS.length))
  }, [])

  const moveBranchStrategyDown = useCallback(() => {
    setBranchStrategyIndex((current) => getNextIndex(current, BRANCH_STRATEGY_OPTIONS.length))
  }, [])

  const moveBranchActionUp = useCallback(() => {
    setBranchActionIndex((current) => getPreviousIndex(current, branchActionOptions.length))
  }, [branchActionOptions.length])

  const moveBranchActionDown = useCallback(() => {
    setBranchActionIndex((current) => getNextIndex(current, branchActionOptions.length))
  }, [branchActionOptions.length])

  const setBranchSelection = useCallback(
    (index: number) => {
      const total = branchOptions.length
      if (total <= 0) return
      const normalized = clampSelectionIndex(index, total)
      setBranchIndex(normalized)
    },
    [branchOptions.length],
  )

  const setBranchStrategySelection = useCallback((index: number) => {
    const total = BRANCH_STRATEGY_OPTIONS.length
    if (total <= 0) return
    const normalized = clampSelectionIndex(index, total)
    setBranchStrategyIndex(normalized)
  }, [])

  const setBranchActionSelection = useCallback(
    (index: number) => {
      const total = branchActionOptions.length
      if (total <= 0) return
      const normalized = clampSelectionIndex(index, total)
      setBranchActionIndex(normalized)
    },
    [branchActionOptions.length],
  )

  const focusBranchDialogList = useCallback(() => {
    setFocus("branch-dialog-list")
  }, [setFocus])

  return {
    branchDialogOpen,
    branchDialogMode,
    branchOptions,
    branchIndex,
    branchActionOptions,
    branchActionIndex,
    selectedBranchForAction,
    branchStrategyOptions: BRANCH_STRATEGY_OPTIONS,
    branchStrategyIndex,
    newBranchName,
    openBranchDialog,
    closeBranchDialog,
    showBranchDialogList,
    submitBranchSelection,
    submitBranchAction,
    submitBranchStrategy,
    createBranchAndCheckout,
    moveBranchSelectionUp,
    moveBranchSelectionDown,
    moveBranchStrategyUp,
    moveBranchStrategyDown,
    moveBranchActionUp,
    moveBranchActionDown,
    setBranchSelection,
    setBranchStrategySelection,
    setBranchActionSelection,
    focusBranchDialogList,
    onBranchNameInput: setNewBranchName,
  }
}
