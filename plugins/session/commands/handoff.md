---
description: Close the session with a handoff in NeoCortex (starting point, log of this session, own mistakes; a backlog only without a backlog system) and check the result measurably
---

# /session:handoff: close the session

Close this session so that the next session knows where we stand, and nothing is lost that exists only in this
conversation. The handoff is a NeoCortex memory, not a file, and it is lean: only what the next session needs. Carry
out the steps below, in this order. Each kind of knowledge goes to its own place.

**Prerequisites:** a NeoCortex MCP server (without one, say so and stop: there is nowhere to write the handoff), and
PowerShell 7 (`pwsh`) for the checker this plugin ships. `<tmp>` below is the temp folder: `$TEMP` where it is set
(Windows), else `$TMPDIR` (macOS), else `/tmp`.

The handoff's section headings and marker phrases stay in Dutch, exactly as written below (`## Eigen fouten` = own
mistakes, `### Afgerond` = completed, "geen waargenomen" = none observed): `Test-Handoff.ps1` and earlier handoffs use
them.

## Name and memory

1. Name, the first that exists, in this order:
   - `$ARGUMENTS`, if given, or a name the user gives for the handoff in this conversation.
   - The session's name: read `~/.claude/projects/*/$CLAUDE_CODE_SESSION_ID/custom-title.json` and use
     `customTitle` (bash: `cat ~/.claude/projects/*/$CLAUDE_CODE_SESSION_ID/custom-title.json`).
   - If that file does not exist or has no `customTitle`, and the session's work sits on a branch other than the
     default one (in the working folder or a worktree): search `labels: ["handoff"]` for a project-scope handoff of
     this repository whose body names that branch as where its work lives. Exactly one: update it, under its own
     name. More than one: ask which. None: go on to the next rule.
   - Otherwise: the name of the repository the session started in (the
     primary working folder, not a folder you moved to later), in lowercase (`MyRepo` becomes `myrepo`). Take the
     folder name of the main checkout: the first line of `git -C "<primary working folder>" worktree list --porcelain`,
     without `worktree `; that way a session in a worktree gets the same name as the main checkout. Do not ask.
   - Only outside a repository and without a session name: ask once for a name — do not guess.
2. Find the handoff with `search_memories`, `labels: ["handoff"]` and the name as the query. Its title is `Handoff: <name>`.
   - **Found**: read it with `get_memory` and write its `body`, as `get_memory` returns it, with the Write tool to `<tmp>/handoff-<short id>-voor.md`: the previous version, for the check. If that file already exists, read it first and overwrite it. Never read NeoCortex files yourself.
   - **Not found**: this becomes a new handoff, with no previous version. Scope `project` in a repo, `user`
     outside a repo.

## What goes where

| Knowledge | Place |
| --- | --- |
| Starting point: where we stand, the next step, what blocks | The handoff's `summary`: one line, at most 300 characters |
| What is still open | The project's backlog system, if Claude may write there (`.claude/delivery.md` names it and who may write); otherwise `## Backlog` in the handoff |
| What was done and decided this session, and which backlog points were finished | `## <today>` in the handoff, with `### Afgerond` if the handoff has a `## Backlog`; the block of an earlier day is dropped |
| This session's own mistakes | `## Eigen fouten` in the handoff; those of earlier sessions are dropped |
| Lessons that must change behaviour in later sessions | A NeoCortex memory of its own, via `search_memories` and then `update_memory` or `save_memory`: one rule per memory, the `summary` is the rule itself |
| Rules that always hold in this project | The project's `CLAUDE.md`, only after the user agrees |
| What changed in documents or scripts | The project's own documentation |

## Steps

1. **Session log.** Under `## YYYY-MM-DD` (today), write briefly what was done and decided technically this session
   (decisions and changes, not intermediate steps), with the work items you created or updated. If the handoff has a
   `## Backlog` (step 2), put `### Afgerond` in today's block, with one list item per backlog point finished this session that
   starts with that point's first five words, verbatim, without number and priority.
   If the previous version already has a block for today, add to it. Do not carry over a block from an earlier day:
   git and the PRs keep what happened then.

2. **Backlog.** What is still open lives in one place.
   - **With a backlog system Claude may write to** (`.claude/delivery.md` names it, or the user says so): every
     open point is a work item there, created or updated this session; the handoff gets **no** `## Backlog`.
     If the previous version still has one, put each of its points to the user once as "already in the system",
     "create" or "drop", and write the handoff without a backlog only after their yes. Only for that one handoff do you
     pass `Test-Handoff.ps1` the switch `-BacklogMoved`; without that switch, a backlog that disappeared fails.
   - **Without one** (or with a backlog that may only be read, such as a customer's): under `## Backlog`, make a
     numbered list of what is still open, with priority. Carry over every point from the previous version that is not
     done, with the same first five words; what is done goes under `### Afgerond`.

3. **Lessons.** Name two or three insights from what went laboriously this session. Invent nothing; only what really
   happened. A lesson that must change behaviour you propose as a memory (step 5). Any other lesson is dropped: the
   handoff has no section for lessons.

4. **Documentation: check and update.** This is the step skipped most often.
   - List what changed this session (files, versions, settings, counts).
   - For each change, check whether the documentation already names it. **Measure it: search for the term or the
     number and state the number of hits.** "Yes, that is updated" without a search is no outcome.
   - Search the other way too: is there a description anywhere that this session made untrue?
   - What cannot be updated or cannot be established goes into the backlog as a point (the work item or `## Backlog`,
     see step 2), marked "not established", with the reason.

5. **Memory.** Propose which context or agreements must go into NeoCortex. Search with `search_memories` first, and
   update an existing memory with `update_memory` instead of saving a new one. The `summary` is the rule itself in
   one sentence of at most 300 characters, the detail is in the text; `why` is required. Save nothing that is already
   in the code, the documentation, git or the handoff. A working-state memory that the handoff now covers shrinks to
   its lasting decisions plus one reference to `Handoff: <name>`.

6. **Starting point.** At most three sentences, together at most 300 characters on one line: where we stand, what the
   next step is, and what still blocks. That becomes the `summary`.

7. **Own mistakes.** Under `## Eigen fouten`, write down what cost you time this session, apart from the task itself: a
   command that had to be rerun, an assumption that was wrong, a rule from the user's instructions that still went wrong. For
   each point, propose how it is prevented from now on (a sharper rule, or a hook if it already went wrong twice). If
   there was nothing, write "geen waargenomen". Do not carry over mistakes from earlier sessions.

8. **Write.** The handoff's text is exactly `## <today>` and `## Eigen fouten`, in that order; without a backlog
   system (step 2), `## Backlog` comes before them and `### Afgerond` sits in today's block.
   - Existing handoff: `update_memory` with the id, the new `summary` and the whole new `body`. Then read it back with `get_memory` and write the `body` to `<tmp>/handoff-<short id>-na.md`.
   - New handoff: `save_memory` with title `Handoff: <name>`, labels `context` and `handoff`, `delivery: index`, the
     scope from "Name and memory", `why` "Working state of <name>, written by /session:handoff.", the
     `summary` and the `body`. Then read it back with `get_memory` and write the `body` to `<tmp>/handoff-<short id>-na.md`.
   - The `-voor` and `-na` files survive between sessions, and the Write tool refuses to overwrite a file it has not
     read: read an existing `-na` file before writing it, and confirm the Write succeeded. A failed Write leaves the
     previous session's file, and the checker then passes on stale text.

## Git

Measure only, do not act: per repo in scope (the working folder and every extra working folder) `git branch --show-current`,
`git log -1 --format=%h`, `git status --short`, `git diff --cached --name-status` (the user may have staged files already)
and `git status -sb` for ahead/behind against the cached origin — **no fetch**. Commit only when the user says so in
this conversation, with named paths (never `git add -A`). **Push only when the user says so in this conversation.**

## Check before you report it done

Give this table, every row measured in this turn, and end with **GO** or **NO-GO**:

| Check | Outcome |
| --- | --- |
| Per repo: branch, HEAD, uncommitted (number of `status --short` lines), staged, ahead/behind | one row per repo |
| Running subagents or background tasks | none, or a list → NO-GO until they are in |
| NeoCortex memories saved or updated this session | short id and title, read back with `get_memory` |
| Handoff | short id, length of the `summary`, verdict of `Test-Handoff.ps1` |
| Anything that still exists only in this conversation | no, or what and where it still has to go |

- **Before the checker**, search the `-na` file for a phrase only this session wrote (a point or a commit hash from
  this session, never the date line, which an earlier handoff of today also has), and run the checker only once it
  is there; never in the same batch of calls as the Write.
- **Run** `pwsh -NoProfile -File "${CLAUDE_PLUGIN_ROOT}/scripts/Test-Handoff.ps1" -Path "<tmp>/handoff-<short id>-na.md" -Previous "<tmp>/handoff-<short id>-voor.md"`
  (without `-Previous` for a new handoff; with `-BacklogMoved` only for the handoff in which the backlog moved to the
  backlog system after the user's yes, step 2) and report its verdict verbatim. FAIL is NO-GO: put a dropped point
  back in the backlog or under `### Afgerond`, write again with `update_memory`, read it back with `get_memory` and write the `body` to `<tmp>/handoff-<short id>-na.md`, and run it again.
- **Finally report:** what was written where, GO or NO-GO, and on GO that the session can be closed
  (`/exit` or `/clear`). The next session sees `Handoff: <name>` in the index and starts with `get_memory <short id>`.

Important: close only after this check. `/clear` or closing before the handoff throws away everything that existed
only in this conversation.

$ARGUMENTS
