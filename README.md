# Stage [Beta]

A calm, opinionated Git TUI.

Inspired by GitHub Desktop. Built with OpenTUI.

Stage keeps the core Git loop focused: review changes, stage with intent, commit clearly, and move on.

What it does:

- Diff-first workflow with per-file stage/unstage
- Fast branch switching and commit history view
- Optional AI-generated conventional commits

<video src="https://github.com/user-attachments/assets/45b376bb-09a1-4666-929a-40017ec7748d" controls></video>

## Get Started

Prerequisite: [Bun](https://bun.sh)

Install:

```bash
bun add -g stage-tui
```

Run:

```bash
stage
```

Debug with your local checkout from any repo:

```bash
export STAGE_DEV_PATH=/absolute/path/to/stage-tui
stage --dev
```

## Use

```bash
stage            # launches immediately and updates in background for next run
stage --dev      # use local checkout at STAGE_DEV_PATH
stage update     # update global install using the same package manager used to install stage
stage update --dry-run   # show detected package manager + update command only
```

AI commit evals:

```bash
bun run eval:ai
bun run eval:ai -- --path src/hooks/use-git-tui-keyboard.ts
bun run eval:ai -- --commit 56d030f072853619483abaf79c57e9104a143d9d
bun run eval:ai -- --commit 56d030f072853619483abaf79c57e9104a143d9d --verbose
```

<details>
<summary>How AI Committer Works (Technical)</summary>

1. Model and output contract
   Stage asks the AI for a commit title in a strict structure: `{ type, optional scope, description }`.  
   Then it converts that into a normal Conventional Commit line like `refactor(ui): simplify sync dialog`.

2. Context construction (single budget)
   Stage builds one text context for the AI that includes:

- which files changed
- what kind of files they are (docs/tests/config/code)
- how much changed in each file (`+added` and `-removed` lines)
- key snippets from diffs
- which folders/modules changed the most  
  `ai.max_input_tokens` is the only user setting for context size.

`line deltas` = lines added and removed. Example: `+120 -40`.

3. Diff handling
   Before sending to AI, Stage compresses diffs to the important parts.  
   If a file diff is huge or unreadable, Stage skips that file’s diff body instead of failing.  
   Stage also spreads context space across files so one giant file does not drown out everything else.

4. Candidate generation and local reranking
   Stage asks for several candidate titles (not just one).  
   Then Stage scores them locally (without another AI model) based on:

- whether the title matches the main changed terms
- whether the commit type looks right (`feat`/`fix`/`refactor`)
- simple wording quality checks  
  Titles that miss the biggest change themes are rejected.

5. Final validation
   Final title must match Conventional Commit format and max length.  
   If all candidates are weak, Stage does one more retry with a focused hint.

6. Eval mode (`bun run eval:ai -- --verbose`)
   `eval:ai` replays a commit in a temp worktree and shows what title the AI would generate.  
   `--verbose` also shows diagnostics like:

- token usage (`used vs max`)
- whether context was trimmed
- how many big files were skipped
- top changed folder groups

</details>

## Configuration

Config file path:

- `${XDG_CONFIG_HOME:-~/.config}/stage/config.toml`

Stage creates this file on first launch.

Optional overrides:

- `STAGE_CONFIG=/path/to/config.toml`
- `./.stage.toml` (repo-local)

Theme behavior:

- `ui.theme = "auto"` follows OS appearance (default)
- `ui.theme = "dark"` or `ui.theme = "light"` forces a mode

<details>
<summary>All Config Options (Defaults)</summary>

```toml
[ui]
diff_view = "unified"                # "unified" | "split"
theme = "auto"                       # "auto" | "dark" | "light"
hide_whitespace_changes = true
show_shortcuts_hint = true

[history]
limit = 200

[git]
auto_stage_on_commit = true

[editor]
command = ""                          # e.g. "code", "cursor", "zed"
args = ["{file}"]                     # placeholders: {file}, {line}

[ai]
enabled = false
provider = "cerebras"                # currently only supported provider
api_key = ""                         # required when enabled = true
model = "gpt-oss-120b"
reasoning_effort = "low"             # "low" | "medium" | "high"
max_input_tokens = 48000
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
- `p`: pull
- `u`: merge remote main into current branch
- `ctrl+p`: push
- `esc`: close dialog (or exit from main view)

</details>

## Credits

- Built with [OpenTUI](https://github.com/anomalyco/opentui)
