# claude-skills

AzureStackNerd's Claude Code plugins, as the marketplace `azurestacknerd-skills`. MIT licensed (see `LICENSE`).

| Plugin | What it gives |
| --- | --- |
| `delivery` | The skill `delivery:delivering-a-story`: refine, design, build and review a backlog story with a Scrum team (Architect, Developer, TestWriter, Reviewer, Scrum Master) as herdr panes, in any repository that has a `.claude/delivery.md` |
| `reader` | The command `read-ask` and its skill: a cheaper, read-only model answers a reconnaissance question (where is X, what calls Y, what does this doc say), so only its short answer enters your context. Haiku by default; your own settings file or model through `READER_SETTINGS` / `READER_MODEL` |
| `session` | The commands `/session:handoff` (write the NeoCortex handoff memory and check it with the bundled `scripts/Test-Handoff.ps1`, which needs PowerShell 7) and `/session:endsession` (persist durable learnings to NeoCortex). They replace the per-pc copies in `~/.claude/commands/`; delete those on each pc once the plugin is installed |

Each plugin works on a fresh Claude Code install: everything a skill or command needs is in the plugin. A user's own
instructions or memory may tune it (another model for a role, a stricter rule), never supply what it needs to run.

## Prerequisites

| Plugin | Needs |
| --- | --- |
| `delivery` | herdr and its `hc` command line for the team's panes; Node.js for the two checkers; a `.claude/delivery.md` in each repository that delivers stories |
| `reader` | The `claude` command on PATH and bash (Git Bash on Windows). A settings file of your own should set its model, or the CLI's default model runs |
| `session` | A NeoCortex MCP server, where the handoff and the learnings are stored; PowerShell 7 (`pwsh`) for `Test-Handoff.ps1` |

## Install on a pc

Without a GitHub SSH key loaded (no passphrase prompt), set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`, or installs from
inside a session and plugin updates can fail.

```shell
claude plugin marketplace add AzureStackNerd/claude-skills
claude plugin install delivery@azurestacknerd-skills
claude plugin install session@azurestacknerd-skills
claude plugin install reader@azurestacknerd-skills
claude plugin details delivery
claude plugin details session
```

The `details` commands list each plugin's skills and commands under its component inventory.

## Update

Auto-update is off for this marketplace until it is turned on per pc (`/plugin`, Marketplaces, this marketplace,
Enable auto-update). By hand:

```shell
claude plugin marketplace update azurestacknerd-skills
claude plugin update delivery@azurestacknerd-skills
claude plugin update session@azurestacknerd-skills
claude plugin update reader@azurestacknerd-skills
```

A pc gets a new copy of a plugin only when `version` in its `plugins/<plugin>/.claude-plugin/plugin.json` changes, so
raise it with every release; a restart applies the update.

## How a repository opts in

Commit a `.claude/delivery.md` in the repository: its end state, its backlog (adapter `azure-devops` or `github`, the
target, the hierarchy, who may write), and one fenced `json` block with its commands, paths, brief rules and done rule,
and optionally the stakeholder's name (`"stakeholder"`), which the refinement checker then accepts as a decider.

**Upgrading to delivery 0.3.0:** a refinement whose points end in `(<a person's name>, <date>)` fails gate 1 until the
repository's project file sets `"stakeholder": "<that name>"`; `(stakeholder, <date>)` always passes.
`plugins/delivery/skills/delivering-a-story/project-file-template.md` describes every field and shows a filled example.
In a repository without one, the skill stops at the start of a story and offers to write it.

## Develop

Scripts use Node's standard library only. From the repository root:

```shell
node --test --test-concurrency=4 plugins/delivery/skills/delivering-a-story/check-refinement.test.mjs plugins/delivery/skills/delivering-a-story/check-gate.test.mjs tests/no-project-specifics.test.mjs tests/session-plugin.test.mjs tests/reader.test.mjs
claude plugin validate .
pwsh -NoProfile -Command "Invoke-Pester -Path plugins/session/scripts/Test-Handoff.Tests.ps1"
```

The Pester tests of `Test-Handoff.ps1` pass on Pester 5.7.1. On one Mac, Pester 6.0.1 failed every test, a trivial
`1 + 1 | Should -Be 2` included, so the cause is that install, not these tests (not checked on Windows); there,
`Import-Module Pester -RequiredVersion 5.7.1` first.

`tests/no-project-specifics.test.mjs` fails when a skill file names a project, its folders or tools; when any plugin
file cites a memory id or names a person, a personal folder or a private rule set; and when `SKILL.md` lacks the
launch command of any of the five panes.
