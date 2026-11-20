# Refinement: #{id} {title}

<!-- Every "## " section below is required, except "Notes for gate 2" and "How"; check-refinement.mjs fails the file
when a required one is missing or empty. A refinement holds what and why; how is decided at gate 2. -->

## User value

As {role}, I want {what}, so that {why}.

When this is done, {who} {can do or gets what}, at {which moment}.

<!-- The first paragraph is the user story, the same sentence that opens the backlog item's description; it may wrap over
lines, and its want is an outcome the user sees, never a means such as a tool, a field or a format version.
check-refinement.mjs fails a "User value" that does not open with "As <role>, I want <what>, so that <why>.".
The second paragraph names the moment the user sees it. -->

## Delivers value alone

yes: {why a user sees the value without another story landing first}
Waits on: none

<!-- "Waits on:" appears once: exactly "none", or the backlog items the value waits on; a yes that waits on anything
fails. A story with no value alone is combined with the ones that make it valuable, and the combination is refined
(the Architect returns NO VALUE ALONE instead of this file). Only when no value
cut exists (the combination is too big and cuts only by layer) write
"no: no value cut exists; {why}" and name what it waits on. -->

## Acceptance criteria

| AC | Criterion | Scenarios | Proving test |
| --- | --- | --- | --- |
| AC1 | {an outcome the user can observe, in the user's words} | S1, S2 | {a test file in the project's tests and "the row name"} |

<!-- An AC is an outcome, never a means: no tool, field, file, format version or row id in "Criterion". The means
belong in the scenario rows and the proving test. -->

## Dimensions

| Dimension | Values | Rows |
| --- | --- | --- |
| {the thing that varies: an operation, a moment, a scope, a record format} | {every value it can take, comma separated} | {the scenario ids that cover it} |

<!-- Every story has dimensions: the operation (a save, an update, a promote), the moment, the scope, the format of
data already stored, the readings of one field. Its bugs hide in the cells of their cross-product that nobody wrote a
row for (on one story a way-out rule covered updates and not saves, and a promote had no row at all; three of its four
fix rounds were such cells). Name each dimension and EVERY value it takes, then the rows that cover
it. The checker fails a dimension whose rows cell names no scenario row, notes one that has fewer rows than values,
and prints the size of the cross-product, so a story with
6 x 5 x 3 x 2 cells is a story someone has to decide about before it is built.
With no second value anywhere, write "None: {why}" with a reason of at least 20 characters, as "Conflicts and unclear
points" does: saying there is no cross-product is a decision, not an omission. -->

## States, moments and places

<!-- One row per scenario, with its own id: every id an AC lists under "Scenarios" is a row here, and every row is
listed by at least one AC. The checker counts ids, never words, so whether the rows cover every moment, place and
stored state the backlog item names is the product owner's judgement before the GO. Work on stored data writes the
stored-state x write-operation table with every cell answered (an unanswered cell is a finding, in a fix round too);
work on when or where something happens writes every moment and place it affects. -->

| Id | State, moment or place | Operation | Expected |
| --- | --- | --- | --- |
| S1 | {one scenario} | {the operation} | {the observable result} |
| S2 | {the next scenario} | {the operation} | {the observable result} |

## Conflicts and unclear points

<!-- One item per point, and every point sits here: a checkbox anywhere else fails. "- [ ]" is open and fails the
checker. A point is a what-question: scope, value, or what an AC promises; a design question goes to "Notes for gate
2" instead. The Architect proposes and never resolves its own point, nor does any other Developer. The product owner
resolves a what-point, tagged "(product owner, {YYYY-MM-DD})"; the stakeholder resolves a point whose answer changes,
narrows or drops an AC, tagged "(stakeholder, {YYYY-MM-DD})" or with the name the project file's "stakeholder" sets. In
autonomous mode a fresh architect stands in for the stakeholder on such a point, tagged
"(deciding architect, {YYYY-MM-DD})". All on one line:
"- [x] {point} Answer: {answer} Serves: {the decision or guardrail it reflects, quoted, or own judgement}
(product owner, {YYYY-MM-DD})".
With no points: "None: {why none}", the reason at least 20 characters. -->

- [ ] {an AC that conflicts with another, with a plan finding, or with the code; or an AC that is unclear}

## Not in this story

{what a reader might expect here and is left out, with where it goes}, or "Nothing: {reason}"

## Estimate

**{1, 2, 3, 5 or 8} points.** Basis: {files touched}, {contracts changed}, {test rows}, {expected lines src + test}.

## Notes for gate 2

<!-- Design questions met while refining, for the Architect and the Developer to settle at gate 2; a design question
is no open point. Leave the section out when there are none. -->

## How

<!-- Written at gate 2 by the Developer, one line per choice the Architect and the Developer settled:
"- <choice>: <why> (architect and developer, YYYY-MM-DD)". Empty until then. -->
