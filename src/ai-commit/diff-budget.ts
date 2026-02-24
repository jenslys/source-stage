import type { TextTokenizer } from "./tokenizer"

export function condenseDiff(diff: string): string {
  const lines = diff.split("\n")
  const relevant: string[] = []
  let changedLines = 0
  let hunkCount = 0
  const maxChangedLines = 120
  const maxHunks = 12

  for (const line of lines) {
    if (line.startsWith("# ")) {
      relevant.push(line)
      continue
    }
    if (line.startsWith("@@")) {
      hunkCount += 1
      if (hunkCount <= maxHunks) {
        relevant.push(line)
      }
      continue
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue
    }
    if (line.startsWith("+") || line.startsWith("-")) {
      changedLines += 1
      if (changedLines <= maxChangedLines) {
        relevant.push(line)
      }
    }
  }

  const body = (relevant.length > 0 ? relevant.join("\n") : diff.trim()).trim()
  return body || ""
}

export function buildDiffSectionWithBudget({
  snippets,
  preambleLines,
  maxInputTokens,
  tokenizer,
}: {
  snippets: Array<{ path: string; body: string }>
  preambleLines: string[]
  maxInputTokens: number
  tokenizer: TextTokenizer
}): string {
  const fallback = "- no diff snippets were captured"
  const preamble = [...preambleLines, "", "Diff highlights:"].join("\n")
  const availableTokens = Math.max(maxInputTokens - tokenizer.encode(preamble).length, 0)
  if (availableTokens <= 0) {
    return truncateToTokenBudget(fallback, 1, tokenizer)
  }

  const prepared = snippets
    .filter((snippet) => snippet.body)
    .map((snippet) => {
      const header = `FILE: ${snippet.path}\n`
      const body = snippet.body
      return {
        header,
        body,
        headerTokens: tokenizer.encode(header).length,
        bodyTokens: tokenizer.encode(body).length,
      }
    })
    .filter((snippet) => snippet.body)

  if (prepared.length === 0) {
    return truncateToTokenBudget(fallback, availableTokens, tokenizer)
  }

  const separator = "\n\n"
  const separatorTokens = tokenizer.encode(separator).length
  const minBodyTokens = 24

  let includeCount = 0
  let fixedCost = 0
  let minimumBodyCost = 0

  for (const snippet of prepared) {
    const joinCost = includeCount > 0 ? separatorTokens : 0
    const minBodyCost = Math.min(minBodyTokens, snippet.bodyTokens)
    const nextCost = fixedCost + minimumBodyCost + joinCost + snippet.headerTokens + minBodyCost
    if (nextCost > availableTokens) {
      break
    }
    includeCount += 1
    fixedCost += joinCost + snippet.headerTokens
    minimumBodyCost += minBodyCost
  }

  if (includeCount === 0) {
    const first = prepared[0]
    if (!first || first.headerTokens >= availableTokens) {
      return truncateToTokenBudget(fallback, availableTokens, tokenizer)
    }
    const bodyBudget = availableTokens - first.headerTokens
    const body = truncateToTokenBudget(first.body, bodyBudget, tokenizer)
    const single = `${first.header}${body}`.trimEnd()
    return single || truncateToTokenBudget(fallback, availableTokens, tokenizer)
  }

  const included = prepared.slice(0, includeCount)
  const bodyBudget = Math.max(availableTokens - fixedCost, 0)
  const allocations = included.map((snippet) => Math.min(minBodyTokens, snippet.bodyTokens))
  let remainingBodyTokens = Math.max(
    bodyBudget - allocations.reduce((sum, value) => sum + value, 0),
    0,
  )

  while (remainingBodyTokens > 0) {
    let progressed = false
    for (let index = 0; index < included.length && remainingBodyTokens > 0; index += 1) {
      const snippet = included[index]
      if (!snippet) continue
      if (allocations[index]! >= snippet.bodyTokens) continue
      allocations[index] = allocations[index]! + 1
      remainingBodyTokens -= 1
      progressed = true
    }

    if (!progressed) {
      break
    }
  }

  const section = included
    .map((snippet, index) => {
      const body = truncateToTokenBudget(snippet.body, allocations[index] ?? 0, tokenizer)
      return `${snippet.header}${body}`.trimEnd()
    })
    .filter(Boolean)
    .join(separator)

  if (!section) {
    return truncateToTokenBudget(fallback, availableTokens, tokenizer)
  }

  return truncateToTokenBudget(section, availableTokens, tokenizer)
}

export function truncateToTokenBudget(
  text: string,
  tokenLimit: number,
  tokenizer: TextTokenizer,
  suffix = "\n...[truncated]",
): string {
  if (tokenLimit <= 0) {
    return ""
  }

  const encoded = tokenizer.encode(text)
  if (encoded.length <= tokenLimit) {
    return text
  }

  const suffixTokens = tokenizer.encode(suffix).length
  if (tokenLimit <= suffixTokens) {
    return tokenizer.decode(encoded.slice(0, tokenLimit)).trimEnd()
  }

  const contentTokenLimit = tokenLimit - suffixTokens
  const clipped = tokenizer.decode(encoded.slice(0, contentTokenLimit)).trimEnd()
  if (!clipped) {
    return tokenizer.decode(encoded.slice(0, tokenLimit)).trimEnd()
  }

  return `${clipped}${suffix}`
}
