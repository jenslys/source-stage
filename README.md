# Source Stage

`source-stage` is an opinionated Git TUI client built with `@opentui/core` and `@opentui/react`.

<video src="https://github.com/user-attachments/assets/5f61e323-bb5e-4b11-9352-182d1a884feb" controls></video>

It is heavily inspired by the simplicity of GitHub Desktop:

- minimal UI
- fast branch/commit workflows
- clear diff-first experience

## Why

Most Git TUIs are feature-heavy. `source-stage` focuses on a smaller, cleaner workflow:

- see changes quickly
- inspect diffs clearly
- commit and sync without leaving the terminal

## Features

- Minimal black UI with syntax-highlighted diff rendering
- Configurable diff mode (`unified` or `split`) with optional whitespace filtering
- File-level include/exclude for commits (auto-stage + selective unstage)
- Fullscreen branch flow:
  - checkout branch
  - create branch
  - choose whether to bring or leave working changes
- Fullscreen commit history:
  - checkout commit
  - revert commit
- Fetch / pull / push actions with fail-fast guardrails
- Shortcut overlay (`?`) to keep default UI clean

## Install

```bash
bun install
```

## Run

```bash
bun run stage
```

If installed as a CLI via `bin`, launch with:

```bash
stage
```

## Configuration

`stage` loads config in this exact order:

1. `STAGE_CONFIG` (explicit path; fails if the file does not exist)
2. `./.stage-manager.toml` (repo-local override for development)
3. `${XDG_CONFIG_HOME:-~/.config}/stage-manager/config.toml` (user config for installed usage)
4. built-in defaults

Example:

```toml
[ui]
diff_view = "unified"                # "unified" | "split"
hide_whitespace_changes = true
show_shortcuts_hint = true

[history]
limit = 200

[git]
auto_stage_on_commit = true

[ai]
enabled = false
provider = "cerebras"        # only supported provider for now
api_key = ""                 # required when enabled = true
model = "gpt-oss-120b"
reasoning_effort = "low"     # "low" | "medium" | "high"
max_files = 32               # number of changed files sent to the model
max_chars_per_file = 4000    # per-file diff budget sent to the model
```

`auto_stage_on_commit` controls commit staging behavior:

- `true`: files start selected; commit stages all changes, then unstages files you unchecked.
- `false`: files start unselected; commit stages only files you explicitly checked.

When `ai.enabled = true`, pressing `c` no longer opens the commit dialog.
Instead, Stage generates a short conventional commit subject with Cerebras and commits immediately.

## Core Shortcuts

- `?`: toggle shortcuts overlay
- `b`: open branch dialog
- `h`: open commit history
- `c`: open commit dialog (or AI auto-commit when enabled)
- `space`: include/exclude selected file for commit
- `↑ / ↓`: move file selection
- `r`: refresh
- `f`: fetch
- `l`: pull
- `p`: push
- `esc`: close current dialog (or exit app from main view)
