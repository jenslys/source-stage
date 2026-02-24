import { runGitRaw, type GitCommandResult } from "../git-process"
import { openFileInEditor } from "../editor-launcher"
import {
  diffForCommitFile,
  diffForFile,
  listCommitFiles,
  listCommits,
  listMergeConflictPaths,
  snapshotRepo,
} from "./read-ops"
import { runWithStashedChanges, runWithTemporaryStash } from "./stash"
import {
  DEFAULT_GIT_CLIENT_OPTIONS,
  type GitClientOptions,
  type RunGit,
  type RunGitOptions,
} from "./types"
import {
  abortMerge,
  checkoutBranch,
  checkoutCommit,
  commitChanges,
  completeMergeCommit,
  createAndCheckoutBranch,
  deleteLocalBranch,
  deleteRemoteBranch,
  fetchRepo,
  hasWorkingTreeChanges,
  isMergeInProgress,
  markConflictResolved,
  mergeRemoteMain,
  popStashRef,
  pullRepo,
  pullRepoMerge,
  pushRepo,
  revertCommit,
} from "./write-ops"

export type {
  ChangedFile,
  CommitFileChange,
  CommitHistoryEntry,
  GitClientOptions,
  RepoSnapshot,
} from "./types"

export class GitClient {
  private constructor(
    private readonly root: string,
    private readonly options: GitClientOptions,
  ) {}

  static async create(cwd: string, options?: Partial<GitClientOptions>): Promise<GitClient> {
    const rootResult = await runGitRaw(cwd, ["rev-parse", "--show-toplevel"])
    if (rootResult.code !== 0) {
      throw new Error(rootResult.stderr || "Current directory is not a git repository.")
    }

    const root = rootResult.stdout.trim()
    if (!root) {
      throw new Error("Failed to resolve git repository root.")
    }

    return new GitClient(root, {
      hideWhitespaceChanges:
        options?.hideWhitespaceChanges ?? DEFAULT_GIT_CLIENT_OPTIONS.hideWhitespaceChanges,
      historyLimit: options?.historyLimit ?? DEFAULT_GIT_CLIENT_OPTIONS.historyLimit,
      autoStageOnCommit: options?.autoStageOnCommit ?? DEFAULT_GIT_CLIENT_OPTIONS.autoStageOnCommit,
    })
  }

  async snapshot() {
    return snapshotRepo(this.root, this.runGit)
  }

  async diffForFile(path: string): Promise<string> {
    return diffForFile(path, this.options.hideWhitespaceChanges, this.runGit)
  }

  async fetch(): Promise<void> {
    await fetchRepo(this.runGit)
  }

  async pull(): Promise<void> {
    await pullRepo(this.runGit)
  }

  async pullMerge(): Promise<void> {
    await pullRepoMerge(this.runGit)
  }

  async pullMergePreservingChanges(): Promise<void> {
    const dirty = await hasWorkingTreeChanges(this.runGit)
    if (!dirty) {
      await pullRepoMerge(this.runGit)
      return
    }
    await runWithTemporaryStash(() => pullRepoMerge(this.runGit), this.runGit, {
      shouldKeepStashOnError: async () => isMergeInProgress(this.runGit),
    })
  }

  async pullFastForwardPreservingChanges(): Promise<void> {
    const dirty = await hasWorkingTreeChanges(this.runGit)
    if (!dirty) {
      await pullRepo(this.runGit)
      return
    }
    await runWithTemporaryStash(() => pullRepo(this.runGit), this.runGit)
  }

  async push(): Promise<void> {
    await pushRepo(this.runGit)
  }

  async mergeRemoteMain(): Promise<string> {
    return mergeRemoteMain(this.runGit)
  }

  async isMergeInProgress(): Promise<boolean> {
    return isMergeInProgress(this.runGit)
  }

  async listMergeConflictPaths(): Promise<string[]> {
    return listMergeConflictPaths(this.runGit)
  }

  async markConflictResolved(path: string): Promise<void> {
    await markConflictResolved(path, this.runGit)
  }

  async completeMergeCommit(): Promise<void> {
    await completeMergeCommit(this.runGit)
  }

  async abortMerge(): Promise<void> {
    await abortMerge(this.runGit)
  }

  async restoreStashRef(stashRef: string): Promise<void> {
    await popStashRef(stashRef, this.runGit)
  }

  async openInEditor(
    path: string,
    editor: {
      command: string
      args: string[]
    },
    line?: number,
  ): Promise<void> {
    await openFileInEditor({
      root: this.root,
      path,
      line,
      editor,
    })
  }

  async listCommits(limit = this.options.historyLimit) {
    return listCommits(limit, this.runGit)
  }

  async listCommitFiles(commitHash: string) {
    return listCommitFiles(commitHash, this.runGit)
  }

  async diffForCommitFile(commitHash: string, path: string): Promise<string> {
    return diffForCommitFile(commitHash, path, this.options.hideWhitespaceChanges, this.runGit)
  }

  async checkout(branch: string): Promise<void> {
    await checkoutBranch(branch, this.runGit)
  }

  async deleteLocalBranch(branch: string): Promise<void> {
    await deleteLocalBranch(branch, this.runGit)
  }

  async deleteRemoteBranch(branch: string): Promise<void> {
    await deleteRemoteBranch(branch, this.runGit)
  }

  async checkoutLeavingChanges(branch: string): Promise<void> {
    await runWithStashedChanges(() => checkoutBranch(branch, this.runGit), this.runGit)
  }

  async checkoutCommit(commitHash: string): Promise<void> {
    await checkoutCommit(commitHash, this.runGit)
  }

  async createAndCheckoutBranch(branchName: string): Promise<void> {
    await createAndCheckoutBranch(branchName, this.runGit)
  }

  async createAndCheckoutBranchLeavingChanges(branchName: string): Promise<void> {
    await runWithStashedChanges(() => createAndCheckoutBranch(branchName, this.runGit), this.runGit)
  }

  async revertCommit(commitHash: string): Promise<void> {
    await revertCommit(commitHash, this.runGit)
  }

  async commit(
    summary: string,
    description: string,
    excludedPaths: string[] = [],
    includedPaths: string[] = [],
  ): Promise<void> {
    await commitChanges(
      summary,
      description,
      excludedPaths,
      includedPaths,
      this.options.autoStageOnCommit,
      this.runGit,
    )
  }

  private readonly runGit: RunGit = async (args, options) => {
    const result = await runGitRaw(this.root, args, {
      timeoutMs: options?.timeoutMs,
    })

    assertExpectedExitCode(result, args, options)
    return result
  }
}

function assertExpectedExitCode(
  result: GitCommandResult,
  args: string[],
  options?: RunGitOptions,
): void {
  const expectedCodes = options?.expectedCodes ?? [0]
  if (expectedCodes.includes(result.code)) {
    return
  }

  const details = result.stderr || result.stdout
  throw new Error(details || `git ${args.join(" ")} failed with code ${result.code}.`)
}
