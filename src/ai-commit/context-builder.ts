import type { ChangedFile, GitClient } from "../git"

import { buildDiffSectionWithBudget, condenseDiff, truncateToTokenBudget } from "./diff-budget"
import {
  aggregateBehaviorCues,
  analyzeDiff,
  collectBehaviorCues,
  formatCueList,
  type BehaviorCues,
  type ContextSignals,
  updatePathCategorySignals,
  updateStatusSignals,
} from "./diff-signals"
import { MAX_RECENT_COMMIT_SUBJECTS } from "./policy"
import type { TextTokenizer } from "./tokenizer"

type BuildCommitContextParams = {
  git: GitClient
  fileByPath: Map<string, ChangedFile>
  selectedPaths: string[]
  maxInputTokens: number
  tokenizer: TextTokenizer
}

export type CommitContextStats = {
  selectedPathsTotal: number
  selectedPathsIncluded: number
  selectedPathsOmittedBySystemLimit: number
  maxInputTokens: number
  preTruncationContextTokens: number
  finalContextTokens: number
  truncatedByTokenBudget: boolean
  omittedDiffFiles: number
}

export type CommitContextBuildResult = {
  context: string
  stats: CommitContextStats
}

type ContextSnippet = {
  path: string
  addedLines: number
  removedLines: number
  behaviorCues: BehaviorCues
  condensed: string
  omitted: boolean
}

const MAX_RAW_DIFF_CHARS_FOR_CONTEXT = 250_000
const MAX_CONTEXT_FILES = 128

export async function buildCommitContext({
  git,
  fileByPath,
  selectedPaths,
  maxInputTokens,
  tokenizer,
}: BuildCommitContextParams): Promise<CommitContextBuildResult> {
  const limitedPaths = selectedPaths.slice(0, MAX_CONTEXT_FILES)
  const signals: ContextSignals = {
    touchedFiles: limitedPaths.length,
    newFiles: 0,
    modifiedFiles: 0,
    deletedFiles: 0,
    renamedFiles: 0,
    addedLines: 0,
    removedLines: 0,
    docsFiles: 0,
    testFiles: 0,
    configFiles: 0,
  }

  const fileSummaries = limitedPaths.map((path) => {
    const file = fileByPath.get(path)
    const status = file ? `${file.indexStatus}${file.worktreeStatus}`.trim() || "??" : "??"
    updateStatusSignals(signals, file)
    updatePathCategorySignals(signals, path)
    return { path, status }
  })

  const snippets = await Promise.all(limitedPaths.map((path) => readContextSnippet(git, path)))
  const omittedDiffFiles = snippets.filter((snippet) => snippet.omitted).length

  const fileLines = fileSummaries.map((entry) => {
    const snippet = snippets.find((candidate) => candidate.path === entry.path)
    const additions = snippet?.addedLines ?? 0
    const deletions = snippet?.removedLines ?? 0
    signals.addedLines += additions
    signals.removedLines += deletions
    return `- ${entry.status} ${entry.path} (+${additions} -${deletions})`
  })

  const behaviorCues = aggregateBehaviorCues(snippets.map((snippet) => snippet.behaviorCues))
  const recentCommitSubjects = await readRecentCommitSubjects(git)
  const existingSurfaceOnly = signals.newFiles === 0 && signals.renamedFiles === 0
  const likelyNewSurface = signals.newFiles > 0 || signals.renamedFiles > 0

  const recentCommitsSection =
    recentCommitSubjects.length > 0
      ? [
          "",
          "Recent commit subjects (style reference only):",
          ...recentCommitSubjects.map((subject) => `- ${subject}`),
        ]
      : []

  const selectedPathsSection =
    selectedPaths.length > limitedPaths.length
      ? `- additional_selected_files_not_shown: ${selectedPaths.length - limitedPaths.length}`
      : "- additional_selected_files_not_shown: 0"

  const preambleLines: string[] = [
    "Context signals:",
    `- touched_files: ${signals.touchedFiles}`,
    `- existing_surface_only: ${existingSurfaceOnly ? "yes" : "no"}`,
    `- likely_new_surface: ${likelyNewSurface ? "yes" : "no"}`,
    `- status_counts: new=${signals.newFiles} modified=${signals.modifiedFiles} deleted=${signals.deletedFiles} renamed=${signals.renamedFiles}`,
    `- diff_line_counts: additions=${signals.addedLines} deletions=${signals.removedLines}`,
    `- file_categories: docs=${signals.docsFiles} tests=${signals.testFiles} config=${signals.configFiles}`,
    `- omitted_diff_files: ${omittedDiffFiles}`,
    selectedPathsSection,
    "- classify by behavior impact first; line counts and file counts are supporting signals",
    "",
    "Behavior cues:",
    `- added_conditions: ${formatCueList(behaviorCues.addedConditions)}`,
    `- removed_conditions: ${formatCueList(behaviorCues.removedConditions)}`,
    `- added_guards: ${formatCueList(behaviorCues.addedGuards)}`,
    `- removed_guards: ${formatCueList(behaviorCues.removedGuards)}`,
    `- added_calls: ${formatCueList(behaviorCues.addedCalls)}`,
    `- removed_calls: ${formatCueList(behaviorCues.removedCalls)}`,
    "",
    "Changed files:",
    fileLines.join("\n"),
    ...recentCommitsSection,
  ]

  const diffSection = buildDiffSectionWithBudget({
    snippets: snippets.map((snippet) => ({ path: snippet.path, body: snippet.condensed })),
    preambleLines,
    maxInputTokens,
    tokenizer,
  })

  const fullContext = [...preambleLines, "", "Diff highlights:", diffSection].join("\n")
  const finalContext = truncateToTokenBudget(
    fullContext,
    maxInputTokens,
    tokenizer,
    "\n...[context truncated]",
  )

  const preTruncationContextTokens = tokenizer.encode(fullContext).length
  const finalContextTokens = tokenizer.encode(finalContext).length
  const selectedPathsIncluded = limitedPaths.length

  return {
    context: finalContext,
    stats: {
      selectedPathsTotal: selectedPaths.length,
      selectedPathsIncluded,
      selectedPathsOmittedBySystemLimit: Math.max(selectedPaths.length - selectedPathsIncluded, 0),
      maxInputTokens,
      preTruncationContextTokens,
      finalContextTokens,
      truncatedByTokenBudget: finalContextTokens < preTruncationContextTokens,
      omittedDiffFiles,
    },
  }
}

async function readContextSnippet(git: GitClient, path: string): Promise<ContextSnippet> {
  try {
    const diff = await git.diffForFile(path)
    if (diff.length > MAX_RAW_DIFF_CHARS_FOR_CONTEXT) {
      // Fallback required: a single oversized patch should not fail AI commit generation.
      return createOmittedContextSnippet(path, "diff too large for AI context")
    }

    const diffStats = analyzeDiff(diff)
    return {
      path,
      addedLines: diffStats.addedLines,
      removedLines: diffStats.removedLines,
      behaviorCues: collectBehaviorCues(diff),
      condensed: condenseDiff(diff),
      omitted: false,
    }
  } catch (error) {
    // Fallback required: keep generating a commit summary when one file diff is unreadable.
    return createOmittedContextSnippet(path, `diff unavailable (${compactError(error)})`)
  }
}

function createOmittedContextSnippet(path: string, reason: string): ContextSnippet {
  return {
    path,
    addedLines: 0,
    removedLines: 0,
    behaviorCues: collectBehaviorCues(""),
    condensed: `# diff omitted: ${reason}`,
    omitted: true,
  }
}

function compactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.replace(/\s+/g, " ").trim()
  return normalized.length > 140 ? `${normalized.slice(0, 137).trimEnd()}...` : normalized
}

async function readRecentCommitSubjects(git: GitClient): Promise<string[]> {
  try {
    const entries = await git.listCommits(MAX_RECENT_COMMIT_SUBJECTS)
    return entries
      .map((entry) => entry.subject.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_COMMIT_SUBJECTS)
  } catch {
    return []
  }
}
