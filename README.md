# Source Stage

Source Stage is an opinionated Git TUI focused on one thing: a clean, fast commit workflow.

Inspired by GitHub Desktop, built for terminal users.

<video src="https://github.com/user-attachments/assets/5f61e323-bb5e-4b11-9352-182d1a884feb" controls></video>

## Why Source Stage

- Minimal interface, diff-first workflow
- Fast branch switching and commit flow
- Auto-stage with per-file include/exclude
- Built-in AI commit message mode (optional)

## Install

Prerequisite: [Bun](https://bun.sh)

Global install:

```bash
bun add -g source-stage
```

Run:

```bash
stage
```

Use local source from the global CLI (debug mode):

```bash
# One-time in current shell
export STAGE_DEV_PATH=/absolute/path/to/source-stage

# From any repo/folder
stage --dev
```

`stage` uses the installed npm package.  
`stage --dev` uses your local checkout at `STAGE_DEV_PATH`.

<details>
<summary>Configuration</summary>

Config file location:

- `${XDG_CONFIG_HOME:-~/.config}/stage-manager/config.toml`

Source Stage auto-creates this file with the full default config on first launch.

Optional overrides:

- `STAGE_CONFIG=/path/to/config.toml`
- `./.stage-manager.toml` (repo-local)

Behavior notes:

- `auto_stage_on_commit = true`: files start selected.
- `auto_stage_on_commit = false`: files start unselected.
- `ai.enabled = true`: `c` generates a conventional commit subject and auto-commits.
- If AI commit generation fails, Source Stage opens the normal commit dialog.

</details>

## Credits

- Built with [OpenTUI](https://github.com/anomalyco/opentui)

<details>
<summary>Shortcuts</summary>

- `?`: toggle shortcuts overlay
- `b`: change branch
- `h`: open commit history
- `c`: open commit dialog (or AI auto-commit when enabled)
- `space`: include/exclude selected file for commit
- `↑ / ↓`: move file selection
- `r`: refresh
- `f`: fetch
- `l`: pull
- `p`: push
- `esc`: close dialog (or exit from main view)

</details>

<details>
<summary>Development</summary>

- Install dependencies: `bun install`
- Run app: `bun run stage`
- Type check: `bunx tsc --noEmit`
- Recommended: set `STAGE_DEV_PATH` in your shell profile for `stage --dev`

</details>

<details>
<summary>All Config Options (Defaults)</summary>

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
provider = "cerebras"                # currently only supported provider
api_key = ""                         # required when enabled = true
model = "gpt-oss-120b"
reasoning_effort = "low"             # "low" | "medium" | "high"
max_files = 32
max_chars_per_file = 4000
```

</details>
