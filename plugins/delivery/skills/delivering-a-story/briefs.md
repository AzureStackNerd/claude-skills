# Briefs for the team

Every brief opens with one or two lines on the product's end state, taken from the project file's "End state"
(`.claude/delivery.md` in the repository), and how this story serves it. Every brief carries the project file's brief
rules, when it has any. Every brief ends with: run commands in the foreground with a timeout; never read
`~/.claude/settings.json`; a final report of at most 15 short lines, verdict first.

`<skill dir>` below is this skill's folder: the product owner writes its absolute path into each brief (SKILL.md, "The
project file and the backlog adapter"). "The source", "the tests", "the tests command", "the row command", "the quick
checks", "the whole suite" and "the scratch path" are the project file's.

When the reader plugin is installed (`command -v read-ask` finds it), every brief also says: **find things with
`read-ask`** (where a function is defined or called, which tests import a module, what a document says) and read with
Read only the files you will edit or must quote exactly; open the `path:line` it quotes before you rely on it.

Every brief also says **what to read and what not to**. A refinement runs about 46k characters (roughly 12k tokens);
an agent that reads it whole to answer one question spends most of its context on rows it will never touch. Name the
ACs, rows and design sections a gate needs (SKILL.md, "Cost").

| Brief | For | When |
| --- | --- | --- |
| 1a, 1b | the Architect writes the refinement; the Developer sizes it with them | gate 1 |
| 2a, 2b | the Architect and the Developer decide how | gate 2 |
| 3 | no agent: the product owner judges the refinement and answers its what-points | end of gate 1, before the GO |
| 4a, 4b | the Developer builds; the TestWriter writes and proves the test per changed site | gate 3 |
| 5 | the Reviewer, independent | gate 4 |
| 6 | the Scrum Master runs the checks and reports each gate's status, then leads the retrospective | every gate, story's end |

## Every agent, whichever gate

- **How a message travels.** You are a herdr pane and cannot reach another pane yet: end your turn with the message, its
  first line `TO <pane>:` (`architect`, `developer`, `tester`, `reviewer`, `scrummaster`, or `main` for the product
  owner). The product owner relays it whole with `hc send` and brings the answer back the same way (SKILL.md, "The
  setup: herdr panes"). "Message the Architect" below means exactly that.
- **One writer per file.** The Architect writes the refinement, the product owner only its answers to open points, and
  the Developer only its "How" section; the Developer writes the source and the docs, the TestWriter the tests. Before
  starting a pane that will write the tree, close every pane of this story that has touched it: a pane whose turn
  failed ("Prompt is too long", a 403) is **not** gone, it wakes on its next message and writes under its replacement.
  Close it with `hc kill <name>` and `hc rm <address>`, and check with `hc ls` that it is gone, never
  only by its last report.
- **A dead agent's state goes on disk as it is made**, never only in its report: the site list, each test and its red
  line, each mutation, and what is still open, appended to the story's gate files as each area finishes. A
  replacement then reads those files instead of rebuilding the state from a message. A message sent to a busy agent
  is read only after its run ends: settle changes to a brief before the work starts, not halfway.
- **A claimed defect quotes the line from disk, with its mtime read first.** A teammate rewriting a file while another
  reads it reports a state that was real minutes earlier; two of one story's defect reports were against text that
  had already been fixed. Quote the line you mean, verbatim, before calling it wrong.
- **One message per settled point.** A teammate sends its reply and then waits for the other side's answer; it does not
  post a stream of follow-ups. Every message that arrives after the other side has already answered costs a
  reconciliation round, not a decision.

## 1a. Refinement (Architect): what and why

- You write the refinement and the Developer sizes it with you (brief 1b). You propose; you decide no what-point: the
  product owner decides what and when, the stakeholder any change to an AC.
- Read: the backlog item and the design sections it names. Read code only to find the moments, places and stored
  states the change touches; how to build it is decided at gate 2, not here.
- Write the refinement from `<skill dir>/refinement-template.md` to the path given, then run
  `node <skill dir>/check-refinement.mjs <path>` from the repository root and fix until the only failures left are
  open points.
- "User value" opens with the user story, `As <role>, I want <what>, so that <why>.`: the one in the backlog item's
  description, or, when it has none or its want is a means, one you propose and return in your report for the
  product owner to decide and put there.
- The user story's want and every AC's "Criterion" state an outcome the user can observe, in the user's words. A tool,
  a field, a file, a format version or a row id is a means: it goes in the scenario rows and the proving test, never in
  the story or in "Criterion".
- No how: no function, no schema or library choice, no design option. A design question you or the Developer meet goes
  under "Notes for gate 2" in the template, for the pair; it is no open point.
- **A refusal this story lifts or rewords drags its test rows with it, and they are counted.** Before the first edit,
  grep the refusal's own text and the function that emits it in the source and the tests (`grep -rn "<the sentence>"
  <source paths> <test paths>`), and list every row that expects it. Those rows change in the same pass as the code,
  never after it, and their count goes in the estimate's basis beside the source lines. A count of source lines alone
  has undercounted every story on record, one by 6.7 times.
- **Write "Dimensions" first, then the rows from it.** Name each thing that varies (the operation, the moment, the
  scope, the format of data already stored, the readings of one field), every value it takes, and the rows that
  cover it; read the cell count the checker prints. A value no row names is the bug a reviewer will find: one story's
  way-out rule covered updates and nothing named a save or a promote, and three of its four fix rounds were those
  cells. Over about 50 cells, the enumerator is part of the story and part of the estimate, not a fix round.
- Every moment, place and stored state the change touches is a scenario: a row with its own id (S1, S2, ...) under
  "States, moments and places", its "Expected" written as what the user observes. Every AC lists the ids of its
  scenarios and names a proving test (`<test file> "<row>"`, a file in the tests, named as the project file's
  `provingTest` says when it sets one), which the pair may move. Every AC
  that conflicts with another AC, a decision of the stakeholder's or the value is an open point `- [ ]` under
  "Conflicts and unclear points".
- You never mark your own point `- [x]` and never end a point with your own role: the product owner answers it in its
  own step (brief 3), or the stakeholder when the answer changes an AC.
- **The estimate is the Developer's count and yours.** When your rows are written, message the Developer that they
  are, and wait for its count (brief 1b). Write the estimate you both agree on; when you do not agree, write the
  higher one and give both, with their bases, in your report.
- `Waits on:` is exactly `none`, or the backlog items the value waits on. If the story delivers nothing a user can see
  on its own and a value cut exists, do not finish the refinement: return NO VALUE ALONE with the stories to combine
  with. Only when no value cut exists, write `no: no value cut exists; <why>` and name what it waits
  on.
- A second round, when the product owner sends gaps back, adds the rows and moves the how it names, and nothing else;
  the Developer recounts only if a row it adds changes the count.
- Return: the checker's output, the estimate with the Developer's count, and the open points, each with the options
  you see; or NO VALUE ALONE.

## 1b. Sizing (Developer): how big, from the code

- You will build this story, so you size it, with the Architect, who writes the refinement (brief 1a). You write
  nothing in it and decide no what-point.
- Read the backlog item and the code each AC touches. Start on the refinement when the Architect tells you its rows are
  written; read the file's mtime first. Skip "Not in this story" and the design docs unless an AC points there.
- Count the estimate's basis from the code: the files and sites the change touches, the contracts it changes, the test
  rows it adds or changes (a refusal it lifts or rewords drags its rows: grep its text), and the expected lines of
  source and of tests. Send the Architect that count and the points it gives (1, 2, 3, 5 or 8; above 8 is a split by
  value).
- Send the Architect, in the same message, each moment, place or stored state the code touches that no row names.
- A design question you meet goes to the Architect for "Notes for gate 2"; you choose no design yet.
- Return: your count, your points, and the rows you found missing.

## 2a. Design (Architect)

- You and the Developer decide how the story is built, together; the TestWriter is consulted on how a choice can be
  tested. Open by sending `main` the single line `ARCHITECT_READY`.
- Read the refinement's ACs and scenario rows, its "Notes for gate 2", the design sections those name, and the code
  its ACs touch. Skip its walk through what is unchanged and the "Not in this story" list unless an AC points there.
- Wait for the Developer's proposal. Challenge it on contracts, coupling, failure modes, the project's own guards and
  the stored states of the scenario rows; propose an alternative where you see a better one. Settle each choice with
  the Developer.
- Neither of you changes, narrows or drops an AC: send such a point to `main` with the options and your
  recommendation, and wait for the stakeholder's answer.
- When every choice is settled and written as a How line by the Developer, send `main` AGREED with the How lines you
  agreed to. Then stay: during the build the Developer brings you its problems, and you settle them the same way.
- One reply per point: send your answer to the Developer's proposal, then wait for its next message. Do not post a
  stream of follow-ups while it is still answering the previous one; each message that lands after it has answered
  costs a reconciliation round. A defect you already reported is not re-reported while the fix is in flight.
- A defect claim quotes the line, verbatim, after reading the file's mtime: a file another teammate is rewriting
  reports a state minutes old, and one story had two defect reports against text already fixed.

## 2b. Design (Developer)

- You and the Architect decide how the story is built, together. Open by sending `main` the single line
  `DEVELOPER_READY`. Write no code yet.
- Read the refinement, its "Notes for gate 2", the design docs it names and the code each AC touches. Check each
  scenario row's "Expected" against the code: a row the code makes wrong, or a moment, place or stored state the code
  touches that no row covers, is a point to settle with the Architect.
- Send the Architect your proposal: per AC, how you would meet it (the sites you would change, the contract each
  change touches, the test that proves it), and the rows you found. Settle every choice with the Architect; ask the
  TestWriter where a choice is hard to test.
- Neither of you changes, narrows or drops an AC: send such a point to `main` with the options, and wait.
- You alone write the "How" section of the refinement: one line per settled choice, `- <choice>: <why> (architect and
  developer, <YYYY-MM-DD>)`. Then send `main` READY with the How lines and your estimate if it moved.

## 3. Judge and answer (the product owner's own step, no agent brief)

This step is yours, the product owner's (the main session), between brief 1 and the GO question; you brief no agent
for it. It replaces the fresh deciding architect: the product owner decides what, and the proposer never decides its
own point.

- Read the backlog item, the refinement's "User value", ACs, scenario rows and "Conflicts and unclear points", and
  the stakeholder's recorded decisions those points touch. Leave the code to the pair at gate 2; read code only for a
  fact an answer rests on.
- Judge the four points of SKILL.md against the backlog item: whether `Waits on: none` is true; whether the scenario
  rows cover every moment, place and stored state the backlog item names; whether the refinement's user story is the
  backlog item's; and whether the want and each AC's criterion are outcomes the user can observe. Judge too whether
  the refinement holds any how.
- Send every gap to the Architect in one message: a missing row, a how to move to "Notes for gate 2", a want or
  criterion to restate as an outcome. That is the pair's second and last run of gate 1. You write no row: scenarios,
  dimensions and the estimate are the Architect's and the Developer's.
- Answer each what-point (scope, value, what an AC promises) with its reason, the strongest case against, the residual
  risk it accepts, and one line `Serves: <the stakeholder's decision or the guardrail it reflects, quoted>`, or
  `Serves: own judgement`. Record it on one line under "Conflicts and unclear points", while the Architect is not
  writing the file:
  `- [x] <point> Answer: <answer> Serves: <...> (product owner, <YYYY-MM-DD>)`.
- A how-question among the points is not yours: it goes with the gaps, to "Notes for gate 2", for the pair.
- A point whose answer would change, narrow or drop an AC, or cross a decision of the stakeholder's, is not yours
  either: ask the stakeholder, one question per point with the options and your recommendation, and record their
  answer as `(stakeholder, <YYYY-MM-DD>)`, or with the name the project file's `"stakeholder"` sets. In autonomous
  mode it goes to a fresh architect standing in for them (SKILL.md, "The team and who decides"), recorded as
  `(deciding architect, <YYYY-MM-DD>)`. Leave such a point `- [ ]` until it is answered.
- An answer that needs a new row goes to the Architect with the gaps. Any other change to a scenario (its operation,
  its expected result, its row, or its id in an AC's "Scenarios") can narrow that AC: it goes to the stakeholder,
  with the old and the new wording, even when the pair agrees on it.
- Have the Scrum Master run the checker until it prints PASS (brief 6). Then ask the stakeholder for the GO with the
  user value line and the estimate, naming a "no value cut exists".

## 4a. Build (Developer), with the stop rule

- Build the story as refined and as the How lines say. A new file is written whole in one Write; edits to an existing
  file are grouped per function. You write the source and the docs; the TestWriter writes the tests (brief 4b).
- Test runs: run exactly the test files the product owner listed (every test file importing a module the change
  touches) with the tests command, plus the quick checks (`node <skill dir>/check-gate.mjs` from the repository root);
  never the whole suite, which is the Scrum Master's run. If you touch another module, grep its importers and run
  those too.
- **The site list.** For each code site you change, append a row to `## Sites` in `<refinement>.gate3.md`: the site
  (`file:line`), what it changes, the AC or scenario row it serves, and each doc that describes it (grep count).
  Build the list from the hunk headers of `git diff -U0`, one row per hunk and comment-only hunks included, never from
  memory; give each function or branch its own row, never one row for a whole file. When an area is done, message the
  TestWriter its sites. The TestWriter mutates its own copy of the tree, never your files; before you edit a file it
  is mutating, ask it and wait for its answer, so no mutation proves a version you have already changed. When you
  edit a site whose row the TestWriter has already proved, tell it which site: that proof is stale until the site is
  mutated again.
- **Keep `<refinement>.gate3.md` up to date** (`## Done and verified`: each area and the command that proved it;
  `## Sites`; `## Not done`), appending after each area rather than at the end: a teammate can die mid-turn, and a
  replacement must read the state from disk instead of rebuilding it from a message.
- **The site-to-test table is yours and the TestWriter's.** It writes the tests and their red lines in
  `<refinement>.gate3-tests.md`; you check that every row of your site list has its row there, and settle a site it
  cannot prove with it.
- **A problem goes to the Architect.** When the code, a How line or a row does not hold as planned, message the
  Architect, settle it together, and record a changed choice as a How line. Do not explain an unmet AC in a code
  comment.
- **Stop rule.** If an AC cannot be met as written: stop at once and send `main` BLOCKED with the AC, what conflicts,
  and the options you and the Architect see. Do not meet the AC "differently".
- Return to `main`: DONE with the AC table, its "Test row" and "Seen red" taken from the TestWriter's file, or BLOCKED.

  | AC | Test row | Seen red | Met |
  | --- | --- | --- | --- |

- A fix-round brief is this brief plus the findings to fix, and one line per state the fixed code's input can be in,
  with what the fix does there, checked in code: a fix adds behaviour, and its edges are where re-reviews find the
  next defect. The test list is never narrower than the list of sites the fix changes; the TestWriter gets brief 4b
  for the sites the fix changes. It names the rows each finding touches and says to read only those: a fix round
  does not re-read the refinement or the design docs, and it does not re-read the code it is not changing (SKILL.md,
  "Cost").

## 4b. Tests per changed site (TestWriter)

- You write the test for each code site the Developer changes and prove each one red. You write the tests only, never
  the source. At gate 2 the pair may ask you how a choice can be tested; answer, and decide no design.
- Read: the Developer's `## Sites` in `<refinement>.gate3.md`, the ACs and scenario rows those sites serve, the proving
  tests the refinement names, and the code of each site. Not the rest of the refinement, and the design docs only
  where a row rests on one.
- Run only the test files you touch and those the product owner listed, with the tests command; never the whole
  suite.
- A test row's expectation is re-derived from the scenario row, never pasted from what the code prints: a copy can
  never fail and proves nothing.
- For each site, a test that goes red when that site alone is reverted. Red is the named test's own failure line,
  quoted, failing on its own assertion; never the file's exit code or a setup error, and never a count inferred from a
  class-wide run. Take the sites from `git diff`, not only from the Developer's list, and list who calls each changed
  function: a value that must agree with the new one may sit outside the diff.
- **A new site has nothing to revert to**: deleting it proves only that it exists. Break each behaviour it carries,
  one mutation per behaviour. A surviving mutant called "equivalent except in state X" is not equivalent: X gets a
  row that kills it, or the code shows X cannot be reached.
- **Before the first mutation**, check that each test's input reaches the condition it claims to test, and run each
  new test alone: a test that passes only after another one left state behind proves nothing. A filter that matches
  no test runs zero tests green: check the run's test count is at least 1.
- **Mutate a copy of the tree, never the working files** while anyone builds or runs tests in them:
  a second folder under the scratch path with its own copy of the source and the tests, refreshed from the working
  tree before each site, its dependencies installed as in the gate's worktree. You restore nothing in the working
  tree. In the copy, a mutation saves the file aside, mutates on a whole-line anchor, re-runs only its named row (the
  row command, checking that the row's own result line is in the output: a filter that matches no row can still
  report a passing count) and restores from the saved file, in one shell chain;
  never `git checkout` to restore. When the Developer asks to edit a file you are mutating, finish or stop that site
  and answer before it edits; refresh the copy after. At most 15 test runs for all mutations together; past that,
  stop and name the sites left. No mutation while the Scrum Master runs the whole suite.
- **Keep `<refinement>.gate3-tests.md` up to date** (`## Site to test`: one row per row of the Developer's site list,
  its test, the red line, and "Proved on": the `git hash-object` of the site's file in the copy after the restore,
  unmutated, the same bytes as the working tree at refresh;
  `## Mutations`: each mutation and the failure line it produced), appending after each site.
- **A proof goes stale when its site changes.** When the Developer tells you it edited a proved site, mark that row
  unproved at once (its "Seen red how" becomes `unproved: site edited`) and mutate it again before the gate, with a
  new red line and hash. Re-runs count against the 15.
- Return to `main`: DONE with the site-to-test table, or the sites left and why.

  | Site (file:line) | Test | Seen red how | Proved on |
  | --- | --- | --- | --- |

## 5. Review (an independent reviewer, never the architect of the pair)

- You were not consulted at gates 2 and 3, so your read is the independent one.
- Read the refinement's AC table, its How lines and the diff. Judge each AC against the behaviour, by running its
  proving test or a probe, not by reading the diff alone; then whether the code does what each How line says; then the
  diff for defects with an effect. Read the AC table, the How lines and the rows the proving tests name; the design
  docs only where an AC rests on one.
- The brief lists ACs, states and How lines, never the Developer's limitation as a constraint to respect.
- Return: APPROVE or CHANGES, the AC table with your own Met column, then each finding as `file:line`, defect, failing
  input.

## 6. Gate checks (Scrum Master)

- You facilitate: you run the checks and report each gate's status to `main`. You decide no content: you edit no
  refinement, code or test, choose no fix, answer no point, and never say how to fix. A failure goes back with the
  check's own lines to whoever owns the failing part.
- Read no refinement prose: your checks are scripts, the gate files and a diff.
- Gate 1: `node <skill dir>/check-refinement.mjs <refinement>` from the repository root, whose project file says
  which test file names count. Report PASS, or each failure and whose it is: an open
  point is the product owner's (a what-point) or the stakeholder's (an AC change); any other failure is the
  Architect's.
- Gate 3, after each area: `node <skill dir>/check-gate.mjs` from the repository root (the quick checks). The first
  time the touched files go green, and again at the gate, the whole suite with `--suite`: first ask `main` for a quiet
  tree (no edit and no mutation in the source or the tests until you report the run finished). At
  the gate it runs in a detached worktree of the commit, with that worktree as the working folder, so the commit's own
  project file drives it. A failing run names its check and prints its last lines and the path of a log with its whole
  output: quote from the log, never re-run the suite to read it.
- Before the review: compare `## Sites` in `<refinement>.gate3.md` and `## Site to test` in
  `<refinement>.gate3-tests.md` with the code hunks of `git diff main`. A hunk without a site row is the Developer's;
  a site without a test row or a quoted failure line is the TestWriter's. Check that every proving test the AC tables
  name exists, by its title. A row whose "Proved on"
  hash differs from the `git hash-object` of its file now, or reads `unproved`, is not proved: its site changed after
  its proof, and it goes back to the TestWriter.
- Gate 4: compare the Developer's AC table with the Reviewer's, line by line, and name each AC where the Met columns
  differ.
- Retrospective, at the story's end, before the panes close: `main` relays each pane's lessons (two or
  three lines each: corrections it got, mistakes it made, what it would do differently). Add your own, then run the
  endsession skill with the Skill tool (a `/endsession` sent with `hc send` arrives as plain text) to save them as
  memories, and report to `main` each memory you saved, by id and title. Without an endsession skill, write the
  lessons to `<refinement>.retro.md` beside the refinement and report its path.
- Return: one line per gate, PASS or FAIL, the command run, the failing lines verbatim, and whose each one is.
