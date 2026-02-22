# Source Stage [Beta]

A calm, opinionated Git TUI.

Inspired by GitHub Desktop. Built with OpenTUI.

Source Stage keeps the core Git loop focused: review changes, stage with intent, commit clearly, and move on.

What it does:

- Diff-first workflow with per-file stage/unstage
- Fast branch switching and commit history view
- Optional AI-generated conventional commits

<video src="https://github.com/user-attachments/assets/5f61e323-bb5e-4b11-9352-182d1a884feb" controls></video>

## Get Started

Prerequisite: [Bun](https://bun.sh)

Install:

```bash
bun add -g source-stage
```

Run:

```bash
stage
```

Debug with your local checkout from any repo:

```bash
export STAGE_DEV_PATH=/absolute/path/to/source-stage
stage --dev
```

## Use

```bash
stage            # use installed npm package
stage --dev      # use local checkout at STAGE_DEV_PATH
```

## Configuration

Config file path:

- `${XDG_CONFIG_HOME:-~/.config}/stage-manager/config.toml`

Source Stage creates this file on first launch.

Optional overrides:

- `STAGE_CONFIG=/path/to/config.toml`
- `./.stage-manager.toml` (repo-local)

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

## Credits

- Built with [OpenTUI](https://github.com/anomalyco/opentui)
