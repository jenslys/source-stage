# Source Stage

`source-stage` is an opinionated Git TUI client built with `@opentui/core` and `@opentui/react`.

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
- Unified diff mode with whitespace-only changes hidden
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

## Core Shortcuts

- `?`: toggle shortcuts overlay
- `b`: open branch dialog
- `h`: open commit history
- `c`: open commit dialog
- `space`: include/exclude selected file for commit
- `↑ / ↓`: move file selection
- `r`: refresh
- `f`: fetch
- `l`: pull
- `p`: push
- `esc`: close current dialog (or exit app from main view)
