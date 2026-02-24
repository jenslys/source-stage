import { COMMIT_SUBJECT_MAX_LENGTH } from "./policy"

export function buildSystemPrompt(retry: boolean): string {
  return [
    "You generate conventional commit subjects from git diff context.",
    "Prioritize semantic correctness over wording novelty.",
    "Commit type rubric:",
    "- fix: behavior correction, bug handling, regression prevention, compatibility adjustment.",
    "- feat: net-new user-facing capability or clearly new surface (new command/screen/endpoint/setting).",
    "- refactor: structural changes with no behavior change.",
    "- style: formatting-only edits.",
    "- docs/test/build/ci/chore/perf/revert only when clearly dominant.",
    "- if uncertain between feat and fix, choose fix.",
    "- do not infer feat only from additions, support wording, or larger diff size.",
    "- if changes are in existing files/flows and no new surface is explicit, avoid feat.",
    "- adding compatibility or alternate paths for an existing workflow is usually fix.",
    "- feat requires introducing a meaningfully new workflow/surface to users.",
    "- when conditions/guards are added, this suggests fix type, but subject wording should focus on the primary user-visible behavior change.",
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
    retry
      ? "Retry mode: if previous output was invalid, simplify wording while keeping meaning."
      : "Return the best single conventional commit subject metadata for this change set.",
  ].join("\n")
}

export function buildUserPrompt(context: string, retry: boolean): string {
  const retryLine = retry
    ? "Retry constraints: keep description short and concrete; prefer simpler scope or omit scope."
    : "Use the context below."

  return [
    retryLine,
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
