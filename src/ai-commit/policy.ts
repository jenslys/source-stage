import { jsonSchema } from "ai"

export const COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const
export type CommitType = (typeof COMMIT_TYPES)[number]

export const SCOPE_REGEX = /^[a-z0-9._/-]+$/
export const MAX_RECENT_COMMIT_SUBJECTS = 6
export const COMMIT_SUBJECT_MAX_LENGTH = 50

export const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: [^A-Z].+$/

const COMMIT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "description"],
  properties: {
    type: {
      type: "string",
      enum: COMMIT_TYPES,
      description: "Conventional commit type based on behavior impact.",
    },
    scope: {
      type: "string",
      description: "Optional subsystem noun such as ui, git, config, keyboard.",
    },
    description: {
      type: "string",
      description: "Imperative, concise summary of what changed.",
    },
  },
} as const

export const COMMIT_OUTPUT_FLEXIBLE_SCHEMA = jsonSchema<{
  type: CommitType
  scope?: string
  description: string
}>(COMMIT_OUTPUT_SCHEMA)
