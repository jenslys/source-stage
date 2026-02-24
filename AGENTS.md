# Repository Guidelines

## Project Structure & Module Organization
- `index.ts`: app entrypoint; creates the OpenTUI renderer and mounts `App`.
- `src/`: core TypeScript source.
- `src/hooks/`: controller and keyboard interaction logic.
- `src/ui/components/`: presentational TUI components (dialogs, panels, shortcuts).
- `src/git.ts`, `src/git-process.ts`, `src/git-status-parser.ts`: Git integration and parsing.
- `src/config.ts`, `src/config-file.ts`: config loading, validation, and default config generation.
- `src/ai-commit.ts`: AI commit subject generation.
- `src/ai-commit-eval.ts`: local evaluator for AI commit outputs (working tree or commit replay).
- `bin/stage`: CLI launcher.

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun run stage`: run the TUI from source.
- `stage --dev`: run local checkout through the CLI wrapper (see README for `STAGE_DEV_PATH`).
- `bunx tsc --noEmit`: required typecheck gate before submitting changes.
- `bun run eval:ai`: evaluate AI commit output for current working changes.
- `bun run eval:ai -- --commit <sha>`: replay a commit in a temp worktree and evaluate generated subject.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules).
- Follow existing style: 2-space indentation, double quotes, no semicolons, concise functions.
- File names: kebab-case (e.g., `use-git-tui-keyboard.ts`).
- Identifiers: `camelCase` for functions/variables, `PascalCase` for React components/types.
- Prefer single-purpose modules and keep business rules centralized (config parsing and AI logic should not be duplicated).

## Testing Guidelines
- No formal test framework is currently configured.
- Minimum validation for every change:
  1. `bunx tsc --noEmit`
  2. Run relevant `eval:ai` checks when touching AI commit logic.
  3. Manual TUI smoke test for changed keyboard/dialog flows.

## Commit & Pull Request Guidelines
- Use Conventional Commits (current history pattern):
  - `fix(keyboard): ...`, `refactor(ui): ...`, `chore: ...`
- Keep subject lines concise and behavior-focused.
- PRs should include:
  - Why the change is needed
  - What changed (key files)
  - Validation performed (commands + manual checks)

## Security & Configuration Tips
- Do not commit secrets (especially `ai.api_key` values from `.stage.toml` or user config files).
- Use `STAGE_CONFIG` for local config overrides when testing variants.
