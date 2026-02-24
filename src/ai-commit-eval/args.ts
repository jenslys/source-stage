import type { CliOptions } from "./types"
import { dedupeNonEmpty, parsePositiveInteger, requireValue, splitPaths } from "./utils"

export const HELP_TEXT = `
AI commit eval runner

Usage:
  bun run src/ai-commit-eval.ts [options]
  bun run eval:ai -- [options]

Modes:
  default                     Evaluate current working tree.
  --commit <sha>              Replay commit changes in a temp worktree and evaluate.
                              Can be repeated.

Path selection:
  --paths <a,b,c>             Evaluate only these changed paths.
  --path <path>               Repeatable single-path form.

AI overrides (optional):
  --api-key <key>
  --model <name>
  --reasoning-effort <low|medium|high>
  --max-input-tokens <int>
  --max-files <int>
  --max-tokens-per-file <int>

Output:
  --json                      Emit machine-readable JSON.
  --keep-worktrees            Keep temp worktrees used for commit replay.
  --help                      Show this help.
`.trim()

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    commits: [],
    paths: [],
    json: false,
    keepWorktrees: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue

    if (arg === "--help" || arg === "-h") {
      return options
    }
    if (arg === "--commit") {
      options.commits.push(requireValue(args, ++index, "--commit"))
      continue
    }
    if (arg === "--paths") {
      options.paths.push(...splitPaths(requireValue(args, ++index, "--paths")))
      continue
    }
    if (arg === "--path") {
      options.paths.push(requireValue(args, ++index, "--path").trim())
      continue
    }
    if (arg === "--api-key") {
      options.apiKey = requireValue(args, ++index, "--api-key")
      continue
    }
    if (arg === "--model") {
      options.model = requireValue(args, ++index, "--model")
      continue
    }
    if (arg === "--reasoning-effort") {
      const value = requireValue(args, ++index, "--reasoning-effort")
      if (value !== "low" && value !== "medium" && value !== "high") {
        throw new Error(`Invalid value for --reasoning-effort: ${value}`)
      }
      options.reasoningEffort = value
      continue
    }
    if (arg === "--max-input-tokens") {
      options.maxInputTokens = parsePositiveInteger(
        requireValue(args, ++index, "--max-input-tokens"),
        "--max-input-tokens",
      )
      continue
    }
    if (arg === "--max-files") {
      options.maxFiles = parsePositiveInteger(
        requireValue(args, ++index, "--max-files"),
        "--max-files",
      )
      continue
    }
    if (arg === "--max-tokens-per-file") {
      options.maxTokensPerFile = parsePositiveInteger(
        requireValue(args, ++index, "--max-tokens-per-file"),
        "--max-tokens-per-file",
      )
      continue
    }
    if (arg === "--json") {
      options.json = true
      continue
    }
    if (arg === "--keep-worktrees") {
      options.keepWorktrees = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  options.paths = dedupeNonEmpty(options.paths)
  options.commits = dedupeNonEmpty(options.commits)
  return options
}
