type CandidateEvaluation = {
  subject: string
  score: number
  hardRejected: boolean
  dominantTokens: string[]
  missingTopTokens: string[]
}

const TOKEN_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "const",
  "else",
  "false",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "is",
  "it",
  "let",
  "new",
  "null",
  "of",
  "on",
  "or",
  "return",
  "set",
  "src",
  "that",
  "the",
  "this",
  "to",
  "true",
  "type",
  "undefined",
  "use",
  "var",
  "with",
])

const VAGUE_LEAD_VERBS = new Set(["support", "update", "improve", "change"])
const DEFECT_EVIDENCE_TERMS = [
  "bug",
  "broken",
  "crash",
  "defect",
  "fault",
  "incorrect",
  "panic",
  "regression",
  "wrong",
]

export function selectBestCommitSubject({
  candidates,
  context,
  selectedPaths,
}: {
  candidates: string[]
  context: string
  selectedPaths: string[]
}): CandidateEvaluation | null {
  const deduped = dedupe(candidates)
  if (deduped.length === 0) {
    return null
  }

  const dominantTokens = collectDominantTokens(context, selectedPaths)
  const evaluations = deduped.map((subject) => evaluateCandidate(subject, context, dominantTokens))
  evaluations.sort((a, b) => b.score - a.score)

  const firstNonRejected = evaluations.find((entry) => !entry.hardRejected)
  return firstNonRejected ?? evaluations[0] ?? null
}

export function buildDominantTokenRetryHint({
  context,
  selectedPaths,
  subject,
}: {
  context: string
  selectedPaths: string[]
  subject: string
}): string | null {
  const dominantTokens = collectDominantTokens(context, selectedPaths)
  if (dominantTokens.length === 0) {
    return null
  }

  const subjectTokens = tokenize(subject)
  const missing = dominantTokens.filter((token) => !subjectTokens.has(token)).slice(0, 3)
  if (missing.length === 0) {
    return null
  }

  return `include dominant changed terms when relevant: ${missing.join(", ")}`
}

function evaluateCandidate(
  subject: string,
  context: string,
  dominantTokens: string[],
): CandidateEvaluation {
  const parsed = parseSubject(subject)
  const subjectTokens = tokenize(subject)
  const defectEvidence = hasDefectEvidence(context)
  const likelyNewSurface = /- likely_new_surface: yes/.test(context)
  const topDominant = dominantTokens.slice(0, 2)
  const missingTopTokens = topDominant.filter((token) => !subjectTokens.has(token))
  const overlap = dominantTokens.filter((token) => subjectTokens.has(token)).length
  const overlapRatio = dominantTokens.length > 0 ? overlap / dominantTokens.length : 1

  const hardRejected = topDominant.length > 0 && missingTopTokens.length === topDominant.length

  let score = 0
  score += hardRejected ? -80 : 24
  score += overlap * 9
  score += Math.round(overlapRatio * 16)

  if (parsed.type === "feat") {
    score += likelyNewSurface ? 6 : -8
  }

  if (parsed.type === "fix") {
    score += defectEvidence ? 8 : -14
  }

  if (parsed.type === "refactor") {
    if (!defectEvidence) score += 6
    if (!likelyNewSurface) score += 3
  }

  const leadVerb = parsed.description.split(/\s+/)[0] ?? ""
  if (VAGUE_LEAD_VERBS.has(leadVerb)) {
    score -= 8
  }

  if (/\band\b/.test(parsed.description)) {
    score += 2
  }

  return {
    subject,
    score,
    hardRejected,
    dominantTokens,
    missingTopTokens,
  }
}

function collectDominantTokens(context: string, selectedPaths: string[]): string[] {
  const counts = new Map<string, number>()

  for (const path of selectedPaths) {
    const uniquePathTokens = new Set(
      splitTokens(path)
        .map(normalizeToken)
        .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token)),
    )
    for (const token of uniquePathTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 2)
    }
  }

  for (const line of extractDiffLines(context)) {
    for (const token of splitTokens(line)
      .map(normalizeToken)
      .filter((value) => value.length >= 3 && !TOKEN_STOPWORDS.has(value))) {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .map(([token, count]) => ({ token, count }))

  const dominant = ranked.filter((entry) => entry.count >= 4).slice(0, 8).map((entry) => entry.token)
  if (dominant.length > 0) {
    return dominant
  }

  return ranked.slice(0, 6).map((entry) => entry.token)
}

function extractDiffLines(context: string): string[] {
  const diffStart = context.indexOf("Diff highlights:")
  const section = diffStart >= 0 ? context.slice(diffStart) : context

  return section
    .split("\n")
    .filter((line) => line.startsWith("+") || line.startsWith("-"))
    .filter((line) => !line.startsWith("+++ ") && !line.startsWith("--- "))
}

function hasDefectEvidence(context: string): boolean {
  const diffText = extractDiffLines(context).join("\n").toLowerCase()
  return DEFECT_EVIDENCE_TERMS.some((term) => diffText.includes(term))
}

function parseSubject(subject: string): { type: string; description: string } {
  const match = subject.match(/^([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/)
  return {
    type: (match?.[1] ?? "").trim(),
    description: (match?.[2] ?? "").trim().toLowerCase(),
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    splitTokens(text)
      .map(normalizeToken)
      .filter((token) => token.length >= 2),
  )
}

function splitTokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function normalizeToken(token: string): string {
  const value = token.toLowerCase()
  if (value.endsWith("ies") && value.length > 4) {
    return `${value.slice(0, -3)}y`
  }
  if (value.endsWith("s") && value.length > 4) {
    return value.slice(0, -1)
  }
  return value
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }
  return output
}
