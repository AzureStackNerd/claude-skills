---
name: delivering-a-story
description: Use when refining, designing, building or reviewing a backlog story or bug with the Scrum team (Architect, Developer, TestWriter, Reviewer, Scrum Master) as herdr panes, before writing any brief for them, and whenever the Developer (the builder) hits an acceptance criterion it cannot meet as written
---

# Delivering a story

## Overview

A story passes four gates. Each gate leaves an artifact the next one checks, and a gate that does not pass stops the
story: no member of the team works around it. The product owner (the main session; "the orchestrator" in older notes)
writes every brief from `briefs.md` in this folder.

The team works as a Scrum team (Scrum Guide 2020): the product owner decides what and when, the Developers decide how,
and the Scrum Master facilitates. Above the team stands **the stakeholder**: the person this session works for, who
gives the GO and decides every change to an acceptance criterion (AC). The project file may set the stakeholder's name
(`"stakeholder"`); the refinement then accepts that name as a decider beside the word "stakeholder".

The user's own instructions and memory may tune this skill (another model for a role, a stricter rule); what the skill
needs to run is all in this folder and the project file.

## The project file and the backlog adapter

This skill names no project. What differs per repository lives in that repository's `.claude/delivery.md`, which
`project-file-template.md` in this folder describes: the product's end state, which every brief opens with; the backlog,
its adapter and target, and who may write to it; the quick checks, the command that runs named test files and the
whole suite with the line that proves it passed; where refinements, gate files and scratch copies go; the lines every
brief carries; and what makes a story done there.

- **At the start of every story, read the repository's `.claude/delivery.md` whole**, then the adapter it names,
  `backlogs/<adapter>.md` in this folder: how to read a backlog item and its children, its states and which one means
  started and which done, how to comment and change a state, and what this skill's words map to.
- **No project file, no story.** When the repository has no `.claude/delivery.md`, stop before any brief: tell the
  stakeholder, and offer to write one from `project-file-template.md`, filled from the repository (its README, its
  build and test files, its backlog). Every brief and both checkers depend on it.
- **The checkers and templates live in this skill's folder, `${CLAUDE_SKILL_DIR}`, never in the repository.** Run them
  by that path with the repository root as the working folder: `node "${CLAUDE_SKILL_DIR}/check-refinement.mjs"
  <file>` and `node "${CLAUDE_SKILL_DIR}/check-gate.mjs"`. `briefs.md` writes `<skill dir>` for it: write the absolute
  path into every brief that runs a checker or reads a template, since a pane has no other way to find it.
- **Names in this skill and in the project file:** "the source" and "the tests" are the project file's source and
  test paths; "the quick checks", "the tests command", "the row command" and "the whole suite" are its commands; a
  story's scratch copies go under its scratch path.

## The team and who decides

- **Product owner**: the main session. Decides what and when: the order of the backlog, the user story, its value and
  its ACs, and every what-point of a refinement (scope, value, what an AC promises). Writes every brief, asks the
  stakeholder for the GO and for every change to an AC, and relays the messages between panes. Decides no how.
- **The Developers**: the Architect, the Developer (who builds; "the builder" in older notes), the TestWriter and the
  Reviewer, with no hierarchy among them. The Developers who will do the work size the story, and they decide how it is
  built, together: a design question met while refining goes to "Notes for gate 2", and at gate 2 the Architect and the
  Developer settle each choice as a How line, never one of them alone. The TestWriter writes and proves the test per
  changed site. The Reviewer stays out of gates 2 and 3 and is only informed of the How lines: its review is the
  independent read.
- **Scrum Master**: facilitates and decides no content. It runs `check-refinement.mjs` and `check-gate.mjs`, keeps the
  four gates and the Definition of Done (gate 4's "Passes when", a test seen red and the docs named for every changed
  site), compares the site-to-test table with `git diff`, and reports each gate's status to the product owner (brief 6).
  It leads the story's retrospective and saves the panes' lessons with the endsession skill (step 7).
- **The stakeholder**: accountable for every change to an AC and for the GO to build and to release; consulted on
  what. There is no refiner role (refinement is the team's activity) and, outside autonomous mode, no separate deciding
  architect.

RASCI (R responsible, A accountable, S support, C consulted, I informed; "Tester" is the TestWriter):

| Activity | PO (main) | Stakeholder | Architect | Developer | Tester | Reviewer | SM |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Backlog order: what and when | A/R | C | I | I | I | I | S |
| User story, value, ACs | A/R | C | C | C | C | I | S |
| Change to an AC | R | A | C | C | C | I | I |
| Scenarios, dimensions, estimate | C | I | R | R | S | I | S |
| Open points: what | A/R | C | C | C | C | I | I |
| Open points: how (design) | I | - | A/R | R | C | I | I |
| Build | I | - | S | A/R | C | I | I |
| Tests per changed site | I | - | C | S | A/R | I | I |
| Review against ACs and DoD | I | I | C | C | C | A/R | S |
| Process, gates, DoD kept | I | I | I | I | I | I | A/R |
| GO to build, release | R | A | I | I | I | I | S |

A resolved point in a refinement ends with its decider: `(product owner, <date>)` for a what-point,
`(stakeholder, <date>)` or `(<the project file's stakeholder name>, <date>)` for one whose answer changes, narrows or
drops an AC, and, in autonomous mode only, `(deciding architect, <date>)`. `check-refinement.mjs` fails any other
decider: the one who proposes a point never decides it.

A point that changes, narrows or drops an AC is the stakeholder's explicit word, at any gate, asked as one question
before the work goes on. Nobody settles it alone: not the Developer by meeting the AC "differently", not the pair by
rewording a row, and never by a code comment explaining why the AC does not hold somewhere. A test that asserts the
contradicting behaviour is worse than none: it makes the violation look deliberate and reviewed.

**Autonomous mode** is when the stakeholder has told this session, in this conversation, to work without them. Then such a point goes to a fresh architect standing in for the stakeholder, briefed with their recorded
decisions and the guardrails. Its answer opens "On the stakeholder's delegation (<date>)" and ends with the checker's
tag `(deciding architect, <date>)`, and the story's final report lists every such answer for the stakeholder to read
back. A gate the checker fails is never passed this way: an estimate above 8 is split by value or recounted.

## The setup: herdr panes

The team runs in herdr panes, never as Agent-tool teammates in the main session: the stakeholder can watch each role
work in its own pane. A relay mistake between panes is fixed in the relaying, not by leaving the panes. Switching
mid-story from teammates to panes: stop the teammates, then start fresh panes that read the story's gate files
(refinement, `<refinement>.gate3.md`, `<refinement>.gate3-tests.md`) instead of rebuilding the state from messages.

**Prerequisites:** herdr and its `hc` command line, and Claude Code in each pane.

- **The panes are the roles:** the product owner is the main session, and `architect`, `developer`, `tester`,
  `reviewer` and `scrummaster` are panes it starts as its children (launch commands below), each launched
  with the repository as its working folder. They are fresh per story: started when the story starts, and closed in
  step 7 once it is done, merged and pushed; only the product owner's session stays across stories.
- **Settle where the work lives before the first pane starts**: a branch in the stakeholder's working copy, or a
  worktree. Ask once when it is unclear. A pane started in the wrong place is replaced later, and loses its context.

### Starting the panes

Start the Architect, the Developer and the Scrum Master together at the story's start (the Scrum Master runs gate 1's
checker), and the TestWriter and the Reviewer before their first brief. A small fix with no refinement starts no
Architect: the Developer and the TestWriter for gates 2 and 3, then the Reviewer and the Scrum Master for gate 4. Run
each command from the main session, in the repository folder, so the pane is its child and `hc wait --children`
reports on it:

```shell
hc run --bg --name architect claude --name Architect --model opus --effort xhigh
hc run --bg --name developer claude --name Developer --model opus --effort medium
hc run --bg --name tester claude --name TestWriter --model opus --effort medium
hc run --bg --name reviewer claude --name Reviewer --model opus --effort high
hc run --bg --name scrummaster claude --name ScrumMaster --model sonnet --effort medium
```

- **These are the defaults.** When the user's own instructions or memory give a different launch command for a role
  (another model, a `--settings` file for a gateway), that command wins; keep the pane name, since the rest of the
  skill addresses panes by it.
- **Set name, model and effort with flags at launch.** `hc send` wraps its text as `<hc from="…">…</hc>`, so a slash
  command sent that way arrives as plain prompt text. The hc name takes only `a-z 0-9 - _`; the visible title comes
  from `claude --name`.
- **Launch only `claude`.** On Windows `hc run` resolves a bare program name on the Windows PATH, not Git Bash's: a bare
  `bash` starts WSL's launcher. A script needs its interpreter's full path.
- **Never pass `--add-dir`**: it stops the pane on the folder-trust dialog. A pane started in the repository still reads
  and edits another folder by absolute path; brief it with absolute paths and `cd <folder> &&` for its commands.
- **`hc` may not be on PATH.** On Windows herdr installs it as `%LOCALAPPDATA%/Programs/herdr-core/hc.exe`; call it by
  that path when the bare name is not found.
- **Read a pane after starting it.** A pane that fails its first task (an API error, a login prompt) is replaced:
  close it with `hc kill <name>` and `hc rm <address>` first, then start the replacement under the same name.
- **The product owner relays every message**, the pair's included, until panes are proven to message each other
  directly: `hc send <pane> "<text>"` delivers it, `hc wait --children any` returns when a pane's turn ends, and
  `hc read <pane>` gives the answer. A pane addresses a message by ending its turn with it, first line
  `TO <pane>:` (`briefs.md`, "Every agent"). The product owner passes each message on whole and adds nothing: relaying
  is not deciding how. Read a pane before sending it work: a dialog open in it blocks the task.

A story runs in one session, with a handoff only at its end, never between its gates. That holds for the panes, which
live for one story, while the product owner's session stays across stories and writes the handoff; the story's lessons
are saved in the Scrum Master's retrospective before the panes close (step 7).

## The gates

| Gate | Who | Artifact | Passes when |
| --- | --- | --- | --- |
| 1. Refinement: what and why | the Architect writes it and the Developer sizes it; the product owner judges it and answers its what-points; the stakeholder answers a point that changes an AC | the refinement file, from `refinement-template.md`, in the project file's refinements path | the Scrum Master runs `node "${CLAUDE_SKILL_DIR}/check-refinement.mjs" <file>` and it prints PASS |
| 2. Design: how | the Architect and the Developer (the pair); the TestWriter consulted | the "How" section of the refinement: one line per choice both agreed | the Developer says READY and the Architect AGREED; no How line changes an AC |
| 3. Build | the Developer builds, the TestWriter writes the test per changed site, the Architect stays reachable | code, tests, `<refinement>.gate3.md`, `<refinement>.gate3-tests.md`, and How lines added when the pair changes a choice | no AC is met "differently"; every problem was settled with the Architect, or, when it touches an AC, by the stakeholder |
| 4. Done | the Reviewer, independent; the Scrum Master checks the gate | the AC table and the site-to-test table | every AC is met in both AC tables, every changed hunk has a site row, the code matches every How line, and the Reviewer says APPROVE |

The stakeholder gives the GO to build after gate 1, asked by the product owner with the estimate and the user value
from the refinement; a "no value cut exists" is named in that GO question. The estimate is the team's count: the
product owner names no number before the Architect and the Developer have counted it from the code. Offering to build
an item the product owner picked is a GO question too, and carries the estimate. Gates 2 to 4 follow in the same
session.

Every story's description holds its user story, `As <role>, I want <what>, so that <why>.` The
product owner writes it into the backlog item's description when it files or refines the story, and the refinement's
"User value" opens with the same sentence. The checker requires a user story there but cannot see the backlog item:
that both hold the same one is the product owner's check before the GO.

The user story's want and every AC's criterion, in the backlog item and in the refinement, state an outcome the user
can observe, in the user's words: stories are about value and outcome. A means is neither: a tool, a
field, a file, a format version ("the format rises to 2.0" is a consequence of a breaking change, not an outcome) or a
row id stays out of the story and out of an AC's "Criterion"; it belongs in that AC's "Scenarios" and "Proving test",
the scenario rows and the backlog item's notes for the Architect.

A refinement holds no how: no function, no schema or library choice, no design option. A design question that comes
up while refining is not an open point there; it goes to gate 2 as a note for the pair. The proving test a refinement
names is where the scenario will be proven, and the pair may move it.

**Name the dimensions before the rows, and read the cell count.** A story's bugs live in the cells of a cross-product
that no row covers, and nothing else in this process finds them: on one story a rule's way out covered updates and no
row named a save or a promote, and three of its four fix rounds were such cells, each found by a reviewer or by an
enumerator written afterwards that found 63 broken refusals in 762. So "Dimensions" names every thing that varies --
the operation, the moment, the scope, the format of data already stored, the readings of one field -- with every
value it takes and the rows covering it. The checker fails a dimension whose rows cell names no scenario row,
notes one that has fewer rows than values, and prints the product's size:

- **up to about 50 cells**: write the rows, and let the product be the reviewer's map;
- **beyond that**: do not write 34 hand rows and hope. Build the enumerator (the cross-product table driven by code,
  as that story's third fix round did) as part of the story, and count it in the estimate. A product of thousands
  under dozens of rows is a story that will return from review with cells missing, whatever the code looks like.

Another story's own table read 2304 cells (4 moments x 2 scopes x 3 writes x 6 file places x 4 record states x 4
pattern kinds) against 34 rows, which is why it did not land.

## Size decides the runs

Stories run one at a time, each finished before the next starts; its size sets the runs:

| Size | Gate 1 | Gates 2 and 3 | After the build |
| --- | --- | --- | --- |
| Small fix or debt item, no AC of its own | no refinement; the stop rule still holds | the Developer and the TestWriter | one review; a re-review only for a defect with an effect |
| Bug of 1 to 3 points | one short read-only run: the Architect writes the cause as the user sees it and a row per scenario, the Developer sizes it; the product owner answers an open what-point, the stakeholder one that changes an AC, each as one line with its strongest case against | the pair and the TestWriter | one review, one fix round, a re-review of the fix only |
| Story, any size | the refinement by the Architect with the Developer sizing it (briefs 1a and 1b), then the product owner's own step (`briefs.md` section 3) | the pair and the TestWriter | as above |

Gate 1 is at most two runs of the Architect and the Developer, never more (four runs in a row, each about 12 minutes
and each re-reading the same code, once put refinement at about 6 hours for a 26-point feature): the refinement, and
one round for the gaps the product owner's judgement finds. The product owner's step is no agent run, and no
separate review of the refinement follows it. The pair checks each scenario row against the code at gate 2, so the
estimate of the GO can still move there.

## The product owner's part

0. **Read the project file and its adapter** (above). Without `.claude/delivery.md`, stop and offer to write one.
1. **Refine.** Brief the Architect with brief 1a and the Developer with brief 1b, and have the Scrum Master run the
   checker on what comes back (brief 6). A structural FAIL goes back to the Architect with the checker's output, never
   to the stakeholder. NO VALUE ALONE is no structural FAIL: propose the smallest combination of stories that delivers
   value to the stakeholder, with its estimate, and refine the combination. Cut a story by what the user gets (a
   vertical slice through source, tools and docs), never by layer (pure code first, wiring later): a cut by
   technical capability is a cut by layer.
2. **Judge and answer: your own step** (`briefs.md` section 3; no agent brief). Judge the refinement against the
   backlog item and send its gaps back to the Architect in one message; answer each what-point and record it as
   `(product owner, <date>)`; take each point that changes an AC to the stakeholder, one question each, or in
   autonomous mode to the architect standing in for them, and record the stakeholder's answer as
   `(stakeholder, <date>)` (or their name from the project file) and the stand-in's as `(deciding architect, <date>)`.
   The proposer never decides its own point. When the Scrum Master reports PASS, ask the stakeholder for the GO.
3. **Freeze the refinement, then start gate 2.** Gate 2 opens only when every writer of the refinement has finished:
   the Architect's turn has ended, your answers are recorded, and the file's mtime has not moved for a full minute.
   Starting while a writer is still busy hands the pair a brief that is already stale (on one story the pair started
   at 11:47, the decider rewrote two rows at 11:49, and both worked from the old text). Shut down every earlier agent
   of this story that does not carry on (see `briefs.md`, "Every agent, whichever gate").
4. **Design.** After the GO, give the Architect brief 2a and the Developer brief 2b: the same two as at gate 1 when
   they still run, else fresh ones that read the refinement. Give the Developer and the TestWriter the test files that
   import each module the change may touch (grep the tests for its importers). Each opens by telling `main` it is
   ready; send it work only after that line. The pair designs without you, apart from your relay; a point that would
   change an AC comes to you and goes to the stakeholder, one question each, and their answer goes back to both.
   Gate 2 ends when the Developer reports READY and the Architect AGREED.
5. **Build, and run the whole suite the first time the touched files go green**, not at the end. Give the Developer
   brief 4a and the TestWriter brief 4b. The Architect stays: the Developer takes every problem to it, the pair
   records a changed choice as a How line, and only a problem that changes an AC comes to you as BLOCKED. The Developer
   keeps `<refinement>.gate3.md` and the TestWriter `<refinement>.gate3-tests.md` beside the refinement, appended after
   each area, so a replacement reads the file instead of rebuilding the state from a message (one story lost half an
   hour to exactly that). The Scrum Master runs `node "${CLAUDE_SKILL_DIR}/check-gate.mjs" --suite` from the
   repository root in a quiet tree (brief 6). Without `--suite` the same script runs only the project file's quick
   checks, in about a second when they are a type check and cheap scans, so it is cheap enough to run after every
   area. The test files outside the touched ones catch what no seven-file run can; on one story a release test went
   red on a pinned built line the change had altered. Repeat it at the gate.
6. **Before the review**, the Scrum Master compares the site-to-test table with the hunks of `git diff`: a hunk without
   a row goes back to the Developer and the TestWriter, never left for the reviewer to find. It runs the whole suite
   once more, at the gate, in a detached worktree of the commit.
7. **Review.** Brief an independent Reviewer with brief 5, never the architect of the pair: the refinement's AC table
   and its How lines, never the Developer's trade-offs as constraints. The Scrum Master compares both AC tables line
   by line before you report. A fix round goes to the same pair and TestWriter. After the last review, close the
   panes, once the story is done (by the project file's done rule, when it has one), merged and pushed, after a
   retrospective: ask each pane for its lessons in two or three lines (corrections it got, mistakes it made, what it
   would do differently) and relay them whole to `scrummaster`, which saves them with the endsession skill and reports
   what it saved (brief 6); lessons kept in your own context can be lost to compaction. Only then close each pane with
   `hc kill <name>` and `hc rm <address>`.

## Cost: what a story reads and where it goes

A story is eight to ten agent turns, and the same few files are read in every one. Counted on 2026-11-11, in
characters, which is what the ratios turn on: one story's refinement was 46.3k, `SKILL.md` 14.5k, `briefs.md` 12.8k,
and a design document it named 133.6k. Eight agents reading the whole refinement is 370k characters on that one file
— and each of them also reads this skill's two files.

- **Brief a slice, not the document.** Tell each agent which ACs, rows and design sections its work touches, and let
  it read those; the whole refinement is for gate 1 and the gate-2 pair, never for a fix round. A fix-round brief
  names the findings and the rows they touch, and says "read only those rows".
- **One reader per question.** The gate-2 pair, the Reviewer and the product owner each read the refinement once for
  their own gate; the TestWriter reads only the rows its sites serve, and the Scrum Master reads it not at all, since
  its checks are scripts and a diff. A second agent that re-reads the refinement to check the first — a line check
  beside a review, say — is usually the cheaper one to drop: the pair already checks its own lines, and the Reviewer
  is the independent read.
- **The gate files replace the message, not the file.** `gate3.md` and `gate3-tests.md` are read by a replacement
  Developer or TestWriter, and by the Scrum Master when it compares the site table with the diff; neither then needs
  the build's message history.
- **A short report is a cheaper report.** Fifteen lines, verdict first, is in every brief because a 60-line report is
  re-read by the product owner and often quoted back to the Developer; it is also what `hc read`
  returns and what the product owner relays.
- **Do not re-read what you just wrote.** After an edit the file's state is known; read it only when a teammate has
  written to it since (check the mtime) or when a finding argues about its text.

## Red flags: the story stops here

| What you see | What it means |
| --- | --- |
| A code comment explains why an AC does not hold at some moment, place or case | An unmet AC decided by the Developer: BLOCKED |
| "A plan finding (or a performance, or a constraint) justifies leaving AC n out" | A conflict between two requirements is a what-point: the product owner decides it, recorded in the refinement; if the answer narrows the AC, the stakeholder does |
| The Architect marks its own open point `- [x]`, or a resolved point ends with a Developer's role | Nobody decided it: the product owner answers it, or the stakeholder when it changes an AC; the checker fails any other decider |
| The product owner settles a design question, or shortens or answers a message it should relay | What and how mixed: a design question goes to the pair, and a relayed message goes on whole |
| The Scrum Master edits a file, picks a fix or answers a point | Facilitation turned into content: it reports the gate status and whose each failure is, nothing more |
| The Developer edits a test file, the TestWriter mutates a file in the working tree, or the Developer edits a file under mutation without the TestWriter's answer | Two writers on one file: the Developer's runs go red on a mutant, a restore wipes an edit, or a mutation proves an old version |
| A site-to-test row counts as proved though its site was edited after it went red | A stale proof: the row is unproved until the TestWriter mutates the site again; its "Proved on" hash shows it |
| A refinement names a function, a schema or library choice, or a design option | How in the refinement: move it to the notes for gate 2, where the pair decides it |
| The Architect and the Developer agree on something no How line records | The Reviewer cannot check it: write the line, or it was not agreed |
| The pair changes, narrows or drops an AC between them | Only the stakeholder changes an AC: stop, and bring it to the product owner |
| A review brief lists the Developer's limitation as a constraint to respect | The Reviewer can no longer find it: brief the AC, not the limitation |
| "The story delivers value once story Y lands", yet `Waits on: none` | `Delivers value alone` is no: combine the stories before the GO |
| The refinement says "None" under conflicts without a reason | The checker fails it; an empty list is a claim and needs its reason |
| A second fix round on the same check | Stop patching: write the contract and a scenario table first |
| The user story's want or an AC's "Criterion" names a tool, a field, a file, a format version or a row id | A means, not an outcome: rewrite it as what the user sees, and move the means to the scenario rows |
| A test's own comment says what it does not assert ("the save asks" where the row requires the question's words) | The expectation was narrowed to the code: fix the code to the row, then widen the assertion |
| A teammate reports a defect in a file another teammate wrote minutes ago, without its mtime | It may be reading a snapshot: quote the line from disk before acting on it |
| The story lifts or rewords a refusal, and the estimate's basis names no test row that expects it | The rows come in the same pass as the code and are counted before it; grep the refusal's text first |
| A story starts in a repository without `.claude/delivery.md` | Every brief and both checkers lack their commands and paths: stop, and offer to write the project file first |

The checker counts declared fields (the user story's `As`, `I want` and `so that`, `Waits on:`, scenario ids,
`Answer:`, `Serves:`, the decider at a resolved point's end) and reads no prose; it does not read the "How" section.
Four things stay a judgement: whether `Waits on: none` is true; whether the scenario rows cover every moment, place and
stored state the backlog item names (an AC that says "every moment" with one row passes the checker); whether the
refinement's user story is the backlog item's; and whether the user story's want and each AC's criterion are outcomes
the user can observe. The product owner judges all four against the backlog item in its own step (`briefs.md` section
3), before the GO question, which carries the user value line.
