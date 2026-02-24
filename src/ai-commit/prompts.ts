import { COMMIT_SUBJECT_MAX_LENGTH } from "./policy"

export function buildSystemPrompt(retry: boolean): string {
  return [
    "You generate conventional commit subjects from git diff context.",
    "Prioritize semantic correctness over wording novelty.",
    "Commit type rubric:",
    "- fix: explicit behavior correction with clear defect evidence (wrong behavior, error handling, regression prevention, compatibility break).",
    "- feat: net-new user-facing capability with clearly new surface, and context should indicate likely_new_surface=yes.",
    "- refactor: structural/simplification/removal changes with no explicit defect correction.",
    "- style: formatting-only edits.",
    "- docs/test/build/ci/chore/perf/revert only when clearly dominant.",
    "- if uncertain between fix and refactor, choose refactor.",
    "- do not infer feat only from additions, support wording, or larger diff size.",
    "- if changes are in existing files/flows and no new surface is explicit, avoid feat.",
    "- when likely_new_surface=no, do not choose feat; choose fix or refactor.",
    "- CLI/UI adjustments inside an existing command/screen are usually fix/refactor unless they clearly add a net-new workflow.",
    "- adding compatibility or alternate paths for an existing workflow is usually fix.",
    "- removing UI elements/flows for simplification without defect evidence is usually refactor.",
    "- feat requires introducing a meaningfully new workflow/surface to users.",
    "- when conditions/guards are added, this suggests fix type, but subject wording should focus on the primary user-visible behavior change.",
    "- do not use defect claims (broken/failing/regression/bug) unless explicitly supported by context and diff.",
    "Style rules:",
    "- scope is optional and must be a lowercase noun token.",
    "- description is imperative, specific, concise, and starts lowercase.",
    "- description must read naturally after '<type>(<scope>):'.",
    `- keep the full subject line at or under ${COMMIT_SUBJECT_MAX_LENGTH} characters, including type/scope and punctuation.`,
    "- for fix, describe the primary user-visible correction first (what changed for users).",
    "- if both guard edits and action/result edits exist, summarize action/result changes over guard mechanics.",
    "- use prevent/avoid wording only when it is the clearest description of the user-visible correction.",
    "- prefer concrete verbs: fix/prevent/handle/remap/retarget/align/rename/normalize/simplify/refine.",
    "- prefer user-visible behavior over internal API detail names.",
    "- avoid wording that names low-level implementation calls unless unavoidable.",
    "- avoid vague lead verbs like support, update, improve, change.",
    "- avoid 'enable' for fix unless the phrase also states what broken behavior is corrected.",
    "- avoid generic phrases like 'update code' or 'improve things'.",
    "Coverage rules:",
    "- infer dominant change themes from changed-files list, path distribution, and behavior cues.",
    "- the description must reflect the dominant theme(s), not a single narrow area when multiple major areas changed.",
    "- if changes span distinct modules (for example ui + git + config), prefer wording that covers cross-cutting behavior.",
    "- avoid overfitting to one directory unless context shows it clearly dominates.",
    retry
      ? "Retry mode: if previous output was invalid, simplify wording while keeping meaning."
      : "Return the best single conventional commit subject metadata for this change set.",
  ].join("\n")
}

export function buildUserPrompt(context: string, retry: boolean, retryReason?: string): string {
  const retryLine = retry
    ? "Retry constraints: keep description short and concrete; prefer simpler scope or omit scope."
    : "Use the context below."
  const retryReasonLine = retryReason?.trim()
    ? `Retry focus: previous draft was weak because ${retryReason.trim()}`
    : null

  return [
    retryLine,
    ...(retryReasonLine ? [retryReasonLine] : []),
    "Output must satisfy schema and conventional commit semantics.",
    "",
    context,
  ].join("\n")
}

export function resolveMaxOutputTokens(reasoningEffort: "low" | "medium" | "high"): number {
  if (reasoningEffort === "high") return 4096
  if (reasoningEffort === "medium") return 3072
  return 2048
}
