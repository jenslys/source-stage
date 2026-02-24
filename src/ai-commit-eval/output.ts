import type { EvalResult } from "./types"

export function printResults(
  results: EvalResult[],
  options: {
    verbose?: boolean
  } = {},
): void {
  for (const [index, result] of results.entries()) {
    console.log(`Result ${index + 1}/${results.length}`)
    console.log(`mode: ${result.mode}`)
    if (result.commit) console.log(`commit: ${result.commit}`)
    if (result.actualSubject) console.log(`actual: ${result.actualSubject}`)
    if (result.worktreePath) console.log(`worktree: ${result.worktreePath}`)
    console.log(`files: ${result.selectedPaths.length}`)
    for (const path of result.selectedPaths) {
      console.log(`- ${path}`)
    }
    console.log(`generated: ${result.generatedSubject}`)
    console.log(`length: ${result.generatedLength}`)
    if (options.verbose && result.contextStats) {
      const {
        selectedPathsTotal,
        selectedPathsIncluded,
        selectedPathsOmittedBySystemLimit,
        maxInputTokens,
        preTruncationContextTokens,
        finalContextTokens,
        truncatedByTokenBudget,
        omittedDiffFiles,
        dominantPathGroups,
        omittedDiffPathsSample,
      } = result.contextStats
      console.log("context:")
      console.log(`  selected_paths_total: ${selectedPathsTotal}`)
      console.log(`  selected_paths_included: ${selectedPathsIncluded}`)
      console.log(`  selected_paths_omitted_by_system_limit: ${selectedPathsOmittedBySystemLimit}`)
      console.log(`  max_input_tokens: ${maxInputTokens}`)
      console.log(`  pre_truncation_tokens: ${preTruncationContextTokens}`)
      console.log(`  final_tokens: ${finalContextTokens}`)
      console.log(`  trimmed_tokens: ${Math.max(preTruncationContextTokens - finalContextTokens, 0)}`)
      console.log(`  truncated_by_token_budget: ${truncatedByTokenBudget ? "yes" : "no"}`)
      console.log(`  omitted_diff_files: ${omittedDiffFiles}`)
      console.log(`  dominant_path_groups: ${dominantPathGroups.join(" | ") || "none"}`)
      console.log(`  omitted_diff_paths_sample: ${omittedDiffPathsSample.join(", ") || "none"}`)
    }
    if (index < results.length - 1) {
      console.log("")
    }
  }
}
