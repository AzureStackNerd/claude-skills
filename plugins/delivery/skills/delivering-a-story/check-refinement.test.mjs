// Tests for check-refinement.mjs. Run them with Node's built-in test runner; the repository README gives the command.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRefinement } from './check-refinement.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const AC_HEADER = '| AC | Criterion | Scenarios | Proving test |\n| --- | --- | --- | --- |';
const DIMENSIONS_HEADER = '| Dimension | Values | Rows |\n| --- | --- | --- |';
const STATES_HEADER = '| Id | State, moment or place | Operation | Expected |\n| --- | --- | --- | --- |';
const VALUE = 'yes: the loader already reads conditions, so a hand-written condition starts to hold at once.';
const NO_CUT = 'no value cut exists; the combination with #432 is 13 points and its parts are cut by layer only, so this slice goes first.';
const POINT = 'Finding 9 limits place reads to three moments.';
const STORY = 'As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context, so that only the rules that apply here reach me.';
const MOMENT = 'When this is done, a user in a fabrikam repo no longer gets a contoso-only rule in full, at every moment.';

const SECTIONS = {
  'User value': `${STORY}\n\n${MOMENT}`,
  'Delivers value alone': `${VALUE}\nWaits on: none`,
  'Acceptance criteria': [
    AC_HEADER,
    '| AC1 | A conditioned rule loads only where its condition holds | S1, S2, S3, S4 | tests/server.test.ts "every moment honours a condition" |',
    '| AC2 | A broken place area fails no moment | S5 | tests/server.test.ts "a broken place area" |',
  ].join('\n'),
  Dimensions: [DIMENSIONS_HEADER, '| The moment the rule loads at | startup, prompt, edit, subagent | S1, S2, S3, S4 |', '| A broken place area | readable, unreadable | S5 |'].join('\n'),
  'States, moments and places': [
    STATES_HEADER,
    '| S1 | full moment at fabrikam | hook_context | contoso rule absent |',
    '| S2 | prompt moment at fabrikam | hook_context | contoso rule absent |',
    '| S3 | edit moment at fabrikam | hook_context | contoso rule absent |',
    '| S4 | subagent moment at fabrikam | hook_context | contoso rule absent |',
    '| S5 | an unreadable .app/places.json | hook_context, every moment | rules load, no moment fails |',
  ].join('\n'),
  'Conflicts and unclear points': `- [x] ${POINT} Answer: read the place per call instead, 1.2 ms measured. Serves: "a condition holds at every moment" (deciding architect, 2026-11-06)`,
  'Not in this story': 'Writing a condition through a tool: slice 7 (#432).',
  Estimate: '**3 points.** Basis: 3 files, 1 contract, 7 rows, about 25 + 150 lines.',
};

/** A refinement with these sections in this order; a section given as null is left out. */
function refinement(overrides = {}) {
  const sections = { ...SECTIONS, ...overrides };
  const parts = ['# Refinement: #440 a condition holds at every moment', ''];
  for (const [title, body] of Object.entries(sections)) if (body !== null) parts.push(`## ${title}`, '', body, '');
  return parts.join('\n');
}

const failuresOf = (text) => checkRefinement(text).failures;
const failsWith = (text, pattern) => assert.ok(failuresOf(text).some((f) => pattern.test(f)), `expected a failure matching ${pattern}, got ${JSON.stringify(failuresOf(text))}`);

/** The valid AC table with AC1's and AC2's Scenarios cells replaced. */
const criteria = (ac1, ac2 = 'S5') =>
  SECTIONS['Acceptance criteria'].replace('| S1, S2, S3, S4 |', `| ${ac1} |`).replace('| S5 |', `| ${ac2} |`);
/** The valid states table with one row's text replaced, or rows added. */
const states = (from, to) => SECTIONS['States, moments and places'].replace(from, to);
const point = (line) => ({ 'Conflicts and unclear points': line });
const WHO = '(deciding architect, 2026-11-06)';
/** The failure of a resolved point whose decider is missing or not allowed: it names the product owner's tag. */
const DECIDER = /resolved point without .*"\(product owner, <date>\)"/;

// The contract's scenario table: one change to the valid refinement per row, and its verdict.
// PASS means no failure at all; a pattern means some failure matches it. Every probe of the two reviews is a row.
const SCENARIOS = [
  // Contract U: "User value" opens with the user story "As <role>, I want <what>, so that <why>." (stakeholder, 2026-11-06).
  ['U1 a "User value" without the user story fails', { 'User value': MOMENT }, /"User value" must open with the user story/],
  ['U2 a user story without "so that" fails', { 'User value': `As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context.\n\n${MOMENT}` }, /"User value" must open with the user story/],
  ['U3 a user story without "I want" fails', { 'User value': `As a user in a fabrikam repo, a contoso-only rule stays out, so that only the rules that apply here reach me.\n\n${MOMENT}` }, /"User value" must open with the user story/],
  ['U4 a user story below the first line fails: it opens the section', { 'User value': `${MOMENT}\n\n${STORY}` }, /"User value" must open with the user story/],
  ['U5 lower case and no commas read as the user story', { 'User value': `as a memory user i want conditions kept so that a memory loads only where it belongs.\n\n${MOMENT}` }, 'PASS'],
  ['U8 bold around the opening "As" reads as the user story', { 'User value': `**As a memory user**, I want conditions kept, so that a memory loads only where it belongs.\n\n${MOMENT}` }, 'PASS'],
  ['U9 a user story wrapped over two lines reads as one (review 1: the repo wraps at 120)', { 'User value': `As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context,\nso that only the rules that apply here reach me.\n\n${MOMENT}` }, 'PASS'],
  ['U10 a blockquoted user story wrapped over two lines reads as one (review 1)', { 'User value': `> As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context,\n> so that only the rules that apply here reach me.\n\n${MOMENT}` }, 'PASS'],
  ['U11 the placeholder user story fails: fill it in (review 2)', { 'User value': `As <role>, I want <what>, so that <why>.\n\n${MOMENT}` }, /"User value" still holds the placeholder user story/],
  ['U12 a user story that starts mid-sentence fails (review 4)', { 'User value': `Today, as a user in a fabrikam repo I want a contoso-only rule to stay out, so that only the rules that apply here reach me.\n\n${MOMENT}` }, /"User value" must open with the user story/],
  ['U13 "so that" with nothing after it fails (review 4)', { 'User value': `As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context, so that.\n\n${MOMENT}` }, /"User value" must open with the user story/],
  ['U14 "so that" in the next paragraph is no part of the user story', { 'User value': `As a user in a fabrikam repo, I want a contoso-only rule to stay out of my context,\n\nso that only the rules that apply here reach me.\n\n${MOMENT}` }, /"User value" must open with the user story/],
  ['U6 a blockquoted user story reads as the user story', { 'User value': `> ${STORY}\n\n${MOMENT}` }, 'PASS'],
  ['U7 "As" is its own word: "Assuming ..." is no user story', { 'User value': `Assuming a user, I want a contoso-only rule to stay out, so that only the rules that apply here reach me.\n\n${MOMENT}` }, /"User value" must open with the user story/],

  // Contract V: "Delivers value alone" is yes or "no: no value cut exists", plus a "Waits on:" line.
  ['V1 a yes that waits on nothing passes', {}, 'PASS'],
  ['V2 a yes that waits on a backlog item fails: combine (review p3, re-review r2-01)', { 'Delivers value alone': 'yes: a user sees it once #433 lands.\nWaits on: #433' }, /"Delivers value alone": a yes that waits on #433 is a no: combine/],
  ['V3 a yes may name the backlog item whose gap it closes (re-review n3)', { 'Delivers value alone': 'yes: it closes the gap #431 left, so a fabrikam user stops getting the contoso rule.\nWaits on: none' }, 'PASS'],
  ['V4 a yes without a "Waits on:" line fails', { 'Delivers value alone': VALUE }, /"Delivers value alone" needs a "Waits on:" line/],
  ['V5 an empty "Waits on:" fails', { 'Delivers value alone': `${VALUE}\nWaits on:` }, /"Delivers value alone" needs a "Waits on:" line/],
  ['V6 "Waits on: none" reads in any case', { 'Delivers value alone': `${VALUE}\nWaits on: None.` }, 'PASS'],
  ['V16 "Waits on:" is exactly none: "none until #433 lands" waits (redesign review)', { 'Delivers value alone': `${VALUE}\nWaits on: none until #433 lands` }, /a yes that waits on none until #433 lands is a no/],
  ['V17 a second "Waits on:" line fails (redesign review)', { 'Delivers value alone': `${VALUE}\nWaits on: none\nWaits on: #433` }, /"Waits on:" appears 2 times/],
  ['V18 a bold yes with a comma or a dash inside the bold reads as yes (redesign review)', { 'Delivers value alone': `**Yes,** ${VALUE.slice(5)}\nWaits on: none` }, 'PASS'],
  ['V19 a bold yes with an em dash inside the bold reads as yes (redesign review)', { 'Delivers value alone': `**Yes —** ${VALUE.slice(5)}\nWaits on: none` }, 'PASS'],
  ['V7 no value cut, with what it waits on, passes (review f2)', { 'Delivers value alone': `no: ${NO_CUT}\nWaits on: #432` }, 'PASS'],
  ['V8 a dash before "no value cut exists" reads as its separator (re-review n10)', { 'Delivers value alone': `no — ${NO_CUT}\nWaits on: #432` }, 'PASS'],
  ['V9 a bold yes reads as yes (review f3)', { 'Delivers value alone': `**yes**: ${VALUE.slice(5)}\nWaits on: none` }, 'PASS'],
  ['V10 a bold yes with its colon inside the bold reads as yes (re-review n4)', { 'Delivers value alone': `**yes:** ${VALUE.slice(5)}\nWaits on: none` }, 'PASS'],
  ['V11 a no without "no value cut exists" fails: combine', { 'Delivers value alone': 'no: it needs #432 before a user can write a condition.\nWaits on: #432' }, /combine this story with the stories that make it valuable/],
  ['V12 "no value cut exists" without its reason fails', { 'Delivers value alone': 'no: no value cut exists.\nWaits on: #432' }, /"no value cut exists" needs its reason/],
  ['V13 neither yes nor no fails', { 'Delivers value alone': 'probably, once the hooks land.\nWaits on: none' }, /"Delivers value alone" must start with yes or no/],
  ['V14 a yes without its reason fails', { 'Delivers value alone': 'yes\nWaits on: none' }, /"Delivers value alone" needs its reason after yes/],
  ['V15 an empty "Waits on:" never borrows the next line', { 'Delivers value alone': `${VALUE}\nWaits on:\nnone of this needs another story.` }, /"Delivers value alone" needs a "Waits on:" line/],

  // Contract S: Scenarios lists scenario ids; each id is a row under "States, moments and places", each row is listed.
  ['S1 Scenarios written as prose fails: list ids (review p0)', { 'Acceptance criteria': criteria('full, prompt, edit and subagent moments') }, /AC1: "Scenarios" must list scenario ids/],
  ['S2 a quantified Scenarios cell fails: list ids (re-review n1)', { 'Acceptance criteria': criteria('every moment') }, /AC1: "Scenarios" must list scenario ids/],
  ['S3 ids mixed with prose fail (re-review r2-04)', { 'Acceptance criteria': criteria('all four moments: S1, S2, S3, S4') }, /AC1: "Scenarios" must list scenario ids/],
  ['S4 an id with no row fails', { 'Acceptance criteria': criteria('S1, S2, S3, S4, S7') }, /AC1 lists S7, which is no row/],
  ['S5 a row no AC lists fails (review p0: AC2 in no row)', { 'Acceptance criteria': criteria('S1, S2, S3, S4', 'S4') }, /S5 is in no AC's "Scenarios"/],
  ['S6 a row may serve two ACs', { 'Acceptance criteria': criteria('S1, S2, S3, S4', 'S4, S5') }, 'PASS'],
  ['S7 ids may be split by commas, semicolons or spaces', { 'Acceptance criteria': criteria('S1; S2 S3,S4') }, 'PASS'],
  ['S8 a repeated row id fails', { 'States, moments and places': states('| S3 |', '| S2 |') }, /"States, moments and places": S2 appears 2 times/],
  ['S9 a row id that is not S<n> fails', { 'States, moments and places': states('| S3 |', '| X3 |') }, /"States, moments and places": "X3" is no scenario id/],
  ['S10 a row with an empty cell fails (review p5)', { 'States, moments and places': states('| hook_context | contoso rule absent |\n| S3', '|  |  |\n| S3') }, /the row "S2 \| prompt moment at fabrikam \| {2}\| " has an empty cell/],
  ['S11 "Not applicable" stands in for no row (review p5)', { 'States, moments and places': 'Not applicable: a docs-only change that no moment or store state reads.' }, /"States, moments and places" has no rows/],
  ['S12 a header-only states table fails', { 'States, moments and places': STATES_HEADER }, /"States, moments and places" has no rows/],
  ['S13 a row text is free: a path, "every" or "all" counts nothing (re-review r2-02, r2-03)', { 'States, moments and places': states('an unreadable .app/places.json', 'a place file with no rules at all, every/any moment') }, 'PASS'],
  ['S14 a states row with fewer cells than the header fails (redesign review)', { 'States, moments and places': states('| S5 | an unreadable .app/places.json | hook_context, every moment | rules load, no moment fails |', '| S5 | an unreadable .app/places.json |') }, /the row "S5 \| an unreadable .app\/places.json" has 2 cells, not 4/],
  ['S15 a states table without the template header fails (redesign review)', { 'States, moments and places': '| Id | Scenario |\n| --- | --- |\n| S1 | full |\n| S2 | prompt |\n| S3 | edit |\n| S4 | subagent |\n| S5 | broken |' }, /"States, moments and places": the header must be "Id \| State, moment or place \| Operation \| Expected"/],
  ['S16 an AC whose Scenarios holds no id fails (redesign review)', { 'Acceptance criteria': criteria('S1, S2, S3, S4, S5', ';') }, /AC2 lists no scenario id/],
  ['S17 an escaped pipe stays inside its cell (redesign review)', { 'Acceptance criteria': SECTIONS['Acceptance criteria'].replace('A conditioned rule loads', "`moment` is `'full' \\| 'prompt'` and a conditioned rule loads") }, 'PASS'],
  ['S18 an AC table without the template header fails', { 'Acceptance criteria': SECTIONS['Acceptance criteria'].replace('| AC | Criterion | Scenarios | Proving test |', '| AC | Criterion | Proving test |') }, /"Acceptance criteria": the header must be "AC \| Criterion \| Scenarios \| Proving test"/],

  // Contract P: a resolved point reads "<point> Answer: <answer> Serves: <...> (product owner|stakeholder|deciding architect, YYYY-MM-DD)".
  // The product owner decides a what-point, the stakeholder an AC change, a deciding architect only in autonomous mode; the
  // proposer never decides its own point (skill rewrite AC1, 2026-11-13). V1 and P9 keep the other two passing.
  ['P1 a resolved point without "Answer:" fails, whatever colon it holds (review p2, re-review r2-07)', point(`- [x] Finding 9 says this: place reads at three moments only. Serves: "every moment" ${WHO}`), /resolved point without "Answer: <answer>"/],
  ['P2 "Serves:" never stands in for the answer (re-review n2)', point(`- [x] Does finding 9 limit AC1 to three moments? Serves: own judgement ${WHO}`), /resolved point without "Answer: <answer>"/],
  ['P3 an answer under 10 characters fails', point(`- [x] Is the edit moment in scope? Answer: yes. Serves: own judgement ${WHO}`), /resolved point needs an answer of at least 10 characters/],
  ['P4 a resolved point without its point fails', point(`- [x] Answer: read the place per call instead. Serves: own judgement ${WHO}`), /resolved point without its point/],
  ['P5 a resolved point without "Serves:" fails', point(`- [x] ${POINT} Answer: read the place per call instead ${WHO}`), /resolved point without "Serves: .*" after its answer/],
  ['P6 "Serves:" before "Answer:" fails', point(`- [x] ${POINT} Serves: own judgement. Answer: read the place per call instead ${WHO}`), /resolved point without "Serves: .*" after its answer/],
  ['P7 the builder resolves nothing', point(`- [x] ${POINT} Answer: three moments only. Serves: "every moment" (builder, 2026-11-06)`), DECIDER],
  ['P8 a resolved point without its date fails', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement (deciding architect)`), DECIDER],
  ['P9 the stakeholder may resolve a point', point(`- [x] AC1 narrows to three moments? Answer: yes, the stakeholder said so on 2026-11-06. Serves: their word (stakeholder, 2026-11-06)`), 'PASS'],
  ['P20 a name the project file does not set resolves nothing', point(`- [x] AC1 narrows to three moments? Answer: yes, Dana said so on 2026-11-06. Serves: their word (Dana, 2026-11-06)`), DECIDER],
  ['P10 a numbered resolved point gets the same checks (re-review B)', point(`1. [x] ${POINT} Answer: read the place per call instead ${WHO}`), /resolved point without "Serves: .*" after its answer/],
  ['P11 an empty "Serves:" fails', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: ${WHO}`), /resolved point without "Serves: .*" after its answer/],
  ['P12 the who and date never count as the answer', point(`- [x] ${POINT} Answer: yes ${WHO}`), /resolved point needs an answer of at least 10 characters/],
  ['P13 a blockquoted open point outside Conflicts fails (redesign review)', { 'Acceptance criteria': `${SECTIONS['Acceptance criteria']}\n\n> - [ ] Does AC1 hold at the prompt moment, given finding 9?` }, /"Acceptance criteria": a point belongs under "Conflicts and unclear points"/],
  ['P14 a blockquoted open point under Conflicts is open (redesign review)', point(`${SECTIONS['Conflicts and unclear points']}\n> - [ ] Does AC2 hold when the place file is missing?`), /open point: .*Does AC2 hold/],
  ['P15 a blockquoted resolved point is a resolved point', point(`> ${SECTIONS['Conflicts and unclear points']}`), 'PASS'],
  ['P16 the product owner may resolve a what-point (skill rewrite AC1)', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement (product owner, 2026-11-13)`), 'PASS'],
  ['P17 the product owner tag reads in any case (skill rewrite AC1)', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement (Product Owner, 2026-11-13)`), 'PASS'],
  ['P18 the architect resolves nothing alone: the proposer never decides its own point (skill rewrite AC1)', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement (architect, 2026-11-13)`), DECIDER],
  ['P19 the developer resolves nothing (skill rewrite AC1)', point(`- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement (developer, 2026-11-13)`), DECIDER],
];

for (const [name, overrides, verdict] of SCENARIOS) {
  test(name, () => {
    if (verdict === 'PASS') assert.deepEqual(failuresOf(refinement(overrides)), []);
    else failsWith(refinement(overrides), verdict);
  });
}

test('the same refinement with CRLF line ends passes', () => {
  assert.deepEqual(failuresOf(refinement().replaceAll('\n', '\r\n')), []);
});

test('CRLF line ends inside a multi-line section are no part of an answer', () => {
  const twoPoints =
    `- [x] AC1 conflicts with finding 9. Answer: read the place per call. Serves: own judgement ${WHO}\n` +
    '- [x] Is the edit moment in scope? Answer: yes, every moment. Serves: "at every moment" (stakeholder, 2026-11-06)';
  assert.deepEqual(failuresOf(refinement(point(twoPoints)).replaceAll('\n', '\r\n')), []);
});

for (const title of Object.keys(SECTIONS)) {
  test(`a refinement without "${title}" fails, naming it`, () => {
    failsWith(refinement({ [title]: null }), new RegExp(`"${title}" is missing`));
  });
  test(`a refinement with "${title}" empty, or holding only a comment, fails`, () => {
    failsWith(refinement({ [title]: '<!-- to fill in -->' }), new RegExp(`"${title}" is empty`));
  });
}

test('the template itself fails', () => {
  const failures = failuresOf(readFileSync(join(HERE, 'refinement-template.md'), 'utf8'));
  assert.ok(failures.length >= 5, JSON.stringify(failures));
  assert.ok(failures.some((f) => /open point/.test(f)), JSON.stringify(failures));
});

test('a section that still holds template text fails', () => {
  failsWith(refinement({ 'User value': 'When this is done, {who} can do it.' }), /"User value" still holds template text: \{who\}/);
});

test('braces inside a code span are no template text', () => {
  assert.deepEqual(failuresOf(refinement({ 'User value': `${STORY}\n\nWhen this is done, \`{labels}\` in a record is honoured at every moment.` })), []);
});

test('a heading inside a fenced code block is no section', () => {
  const text = refinement({ 'User value': null }) + '\n```md\n## User value\n\nWhen this is done, a fake.\n```\n';
  failsWith(text, /"User value" is missing/);
});

test('a duplicated section fails', () => {
  failsWith(`${refinement()}\n## Estimate\n\n**2 points.** Basis: 1 file and a few lines.\n`, /"Estimate" appears 2 times/);
});

test('an acceptance-criteria table without a data row fails', () => {
  failsWith(refinement({ 'Acceptance criteria': AC_HEADER }), /no AC rows/);
});

test('an AC row with an empty cell fails, naming the AC and the column', () => {
  failsWith(refinement({ 'Acceptance criteria': `${AC_HEADER}\n| AC1 | Loads only where it holds | S1 |  |` }), /AC1: "Proving test" is empty/);
});

test('a proving test that names no test file and quoted row fails (review p4)', () => {
  const ac = SECTIONS['Acceptance criteria'];
  failsWith(refinement({ 'Acceptance criteria': ac.replace('tests/server.test.ts "a broken place area"', 'TBD') }), /AC2: "Proving test" names no test file and quoted row: TBD/);
  failsWith(refinement({ 'Acceptance criteria': ac.replace('tests/server.test.ts "a broken place area"', 'tests/server.test.ts') }), /AC2: "Proving test" names no test file and quoted row/);
  failsWith(refinement({ 'Acceptance criteria': ac.replace('tests/server.test.ts "a broken place area"', '"a broken place area"') }), /AC2: "Proving test" names no test file and quoted row/);
});

test('an AC row whose id is not AC<n>, or a repeated id, fails', () => {
  failsWith(refinement({ 'Acceptance criteria': `${AC_HEADER}\n| A1 | x holds | S1 | test z |` }), /"A1" is no AC id/);
  failsWith(refinement({ 'Acceptance criteria': `${AC_HEADER}\n| AC1 | x holds | S1 | test z |\n| AC1 | w holds | S2 | test u |` }), /AC1 appears 2 times/);
});

test('an open point fails, one failure per point', () => {
  const text = refinement(point(`- [ ] AC1 conflicts with finding 9\n- [ ] Is the edit moment in scope?\n- [x] ${POINT} Answer: read the place per call instead. Serves: own judgement ${WHO}`));
  assert.equal(failuresOf(text).filter((f) => /open point/.test(f)).length, 2);
});

test('a point outside "Conflicts and unclear points" fails, open or resolved (review p1, p6)', () => {
  const underAc = `${SECTIONS['Acceptance criteria']}\n\n- [ ] Does AC1 hold at the prompt moment, given finding 9?`;
  failsWith(refinement({ 'Acceptance criteria': underAc }), /"Acceptance criteria": a point belongs under "Conflicts and unclear points": - \[ \] Does AC1 hold/);
  failsWith(refinement({ 'Open questions': '- [ ] AC1 conflicts with finding 9: who decides?' }), /"Open questions": a point belongs under "Conflicts and unclear points"/);
  const resolvedElsewhere = `${SECTIONS['Not in this story']}\n\n- [x] Is slice 7 in? Answer: no, it is #432 on its own. Serves: own judgement ${WHO}`;
  failsWith(refinement({ 'Not in this story': resolvedElsewhere }), /"Not in this story": a point belongs under "Conflicts and unclear points"/);
});

test('a point marked with "+" or a number is a point too (re-review B)', () => {
  const underAc = (marker) => `${SECTIONS['Acceptance criteria']}\n\n${marker} [ ] Does AC1 hold at the prompt moment, given finding 9?`;
  failsWith(refinement({ 'Acceptance criteria': underAc('+') }), /"Acceptance criteria": a point belongs under/);
  failsWith(refinement({ 'Acceptance criteria': underAc('1.') }), /"Acceptance criteria": a point belongs under/);
  const plusOpen = `${SECTIONS['Conflicts and unclear points']}\n+ [ ] Does AC2 hold when the place file is missing?`;
  failsWith(refinement(point(plusOpen)), /open point: .*Does AC2 hold/);
});

test('an open point says the product owner answers it, or the stakeholder for an AC change, never a fresh deciding architect (skill rewrite AC2)', () => {
  const open = failuresOf(refinement(point('- [ ] Is the edit moment in scope?'))).filter((f) => /open point/.test(f));
  assert.equal(open.length, 1, JSON.stringify(open));
  assert.match(open[0], /product owner/i);
  assert.match(open[0], /the stakeholder when/);
  assert.doesNotMatch(open[0], /fresh deciding architect/i);
});

// The stakeholder signs as "stakeholder" or by the name a project file's "stakeholder" sets, so a team that writes its
// stakeholder's name keeps its refinements passing; any other name decides nothing.
const BY_NAME = '- [x] AC1 narrows to three moments? Answer: yes, Dana said so on 2026-11-06. Serves: their word (Dana, 2026-11-06)';

test('a stakeholder named in the options may sign by name, and still as "stakeholder"; the open point names them', () => {
  const named = { stakeholder: 'Dana' };
  assert.deepEqual(checkRefinement(refinement(point(BY_NAME)), named).failures, []);
  assert.deepEqual(checkRefinement(refinement(point(BY_NAME.replace('(Dana,', '(stakeholder,'))), named).failures, []);
  const open = checkRefinement(refinement(point('- [ ] Is the edit moment in scope?')), named).failures.filter((f) => /open point/.test(f));
  assert.match(open[0], /the stakeholder \(Dana\) when/);
  const other = checkRefinement(refinement(point(BY_NAME.replace('(Dana,', '(Robin,'))), named).failures;
  assert.ok(other.some((f) => /"\(Dana, <date>\)"/.test(f)), JSON.stringify(other));
});

test('a stakeholder name is taken literally, never as a pattern', () => {
  const dotted = checkRefinement(refinement(point(BY_NAME.replace('(Dana,', '(J. Doe,'))), { stakeholder: 'J. Doe' }).failures;
  assert.deepEqual(dotted, []);
  const lookalike = checkRefinement(refinement(point(BY_NAME.replace('(Dana,', '(JX Doe,'))), { stakeholder: 'J. Doe' }).failures;
  assert.ok(lookalike.some((f) => /resolved point without/.test(f)), JSON.stringify(lookalike));
});

test('"None" needs a reason of at least 20 characters', () => {
  failsWith(refinement(point('None')), /"None" needs a reason/);
  failsWith(refinement(point('None: fine')), /"None" needs a reason/);
  assert.deepEqual(failuresOf(refinement(point('None: every AC maps to one moment and no plan finding limits it.'))), []);
});

/** The Dimensions section with its row text replaced, so one check is probed at a time. */
const dimensions = (table) => ({ Dimensions: table });

test('a dimension whose values outnumber its rows is noted, and one with no row at all fails (#455)', () => {
  // #455's own shape: the way-out rule covered updates, and nothing named a save. One row, two operations.
  const { failures, notes } = checkRefinement(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save, update | S1 |`)));
  assert.deepEqual(failures, []);
  assert.match(notes.join('\n'), /"Dimensions": The write has 2 values and 1 row\(s\)/);
  assert.deepEqual(failuresOf(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save, update | S1, S2 |`))), []);
  // A value with NO row at all is the failure the note above warns about, and it is a failure now.
  failsWith(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save, update | none yet |`)), /names no scenario row/);
});

test('a dimension that varies once fails: a dimension with one value is no dimension', () => {
  failsWith(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save | S1 |`)), /names one value \(save\): a dimension that varies once is no dimension/);
  failsWith(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | | S1 |`)), /names no value/);
});

test('a dimension with no scenario row, an empty cell, and the wrong header all fail', () => {
  failsWith(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save, update | none yet |`)), /names no scenario row/);
  failsWith(refinement(dimensions(`${DIMENSIONS_HEADER}\n| The write | save, update | |`)), /has an empty cell/);
  failsWith(refinement(dimensions('| Dim | Values | Rows |\n| --- | --- | --- |\n| The write | save, update | S1 |')), /the header must be/);
});

test('"None" with a reason is a story that says why it has no cross-product', () => {
  failsWith(refinement(dimensions('None')), /"Dimensions": "None" needs a reason/);
  assert.deepEqual(failuresOf(refinement(dimensions('None: the one operation this story adds has a single value.'))), []);
});

test('the size of the cross-product is printed as a note, so a 6 x 5 x 3 story is visible before it is built', () => {
  const text = refinement(dimensions([
    DIMENSIONS_HEADER,
    '| The write | save, update, promote | S1 |',
    '| The scope | user, project | S2 |',
    '| The format | 1.0, 2.0 | S3 |',
  ].join('\n')));
  const { failures, notes } = checkRefinement(text);
  assert.deepEqual(failures, []);
  assert.match(notes.join('\n'), /the cross-product is 12 cells \(The write 3 x The scope 2 x The format 2\)/);
});

test('the command line prints the cross-product note beside PASS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-refinement-dims-'));
  const file = join(dir, 'dims.md');
  writeFileSync(file, refinement());
  const run = spawnSync(process.execPath, [join(HERE, 'check-refinement.mjs'), file], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /note: "Dimensions": the cross-product is 8 cells \(The moment the rule loads at 4 x A broken place area 2\)/);
});

test('the estimate must be 1, 2, 3, 5 or 8 points with its basis', () => {
  failsWith(refinement({ Estimate: '**13 points.** Basis: 9 files, 3 contracts, 57 rows.' }), /above 8: split it by user value/);
  failsWith(refinement({ Estimate: '**4 points.** Basis: 2 files, 1 contract, 4 rows.' }), /4 is no Fibonacci point/);
  failsWith(refinement({ Estimate: '**3 points.**' }), /"Estimate" needs "Basis:"/);
  failsWith(refinement({ Estimate: 'Basis: 3 files, 1 contract, 7 rows.' }), /"Estimate" names no points/);
});

test('"story points" counts as points (review f1)', () => {
  assert.deepEqual(failuresOf(refinement({ Estimate: '**3 story points.** Basis: 3 files, 1 contract, 7 rows, about 25 + 150 lines.' })), []);
});

test('the command line prints PASS and exits 0 for a complete file, FAIL and 1 otherwise', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-refinement-'));
  const good = join(dir, 'good.md');
  const bad = join(dir, 'bad.md');
  writeFileSync(good, refinement());
  writeFileSync(bad, refinement({ Estimate: null }));
  const run = (file) => spawnSync(process.execPath, [join(HERE, 'check-refinement.mjs'), file], { encoding: 'utf8' });
  const pass = run(good);
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /^PASS: /);
  const fail = run(bad);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /^FAIL: /);
  assert.match(fail.stdout, /"Estimate" is missing/);
  const missing = run(join(dir, 'nope.md'));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout + missing.stderr, /cannot be read/);
});

// The proving test's file name is the project's: a "provingTest" in .claude/delivery.md of the working folder sets it
// (product owner, 2026-11-15). These rows run the command line in a scratch repository, as the Scrum Master does.

/** The valid refinement with both proving tests named `file`, each with its own quoted row. */
const provedBy = (file) =>
  refinement({
    'Acceptance criteria': SECTIONS['Acceptance criteria']
      .replace('tests/server.test.ts "every moment honours a condition"', `${file} "every moment honours a condition"`)
      .replace('tests/server.test.ts "a broken place area"', `${file} "a broken place area"`),
  });

/** The checker's command line in a scratch repository whose project file is `project` (none when null). */
function inRepository(project, text) {
  const dir = mkdtempSync(join(tmpdir(), 'check-refinement-project-'));
  if (project !== null) {
    mkdirSync(join(dir, '.claude'));
    const body = typeof project === 'string' ? project : `# Project\n\n\`\`\`json\n${JSON.stringify(project, null, 2)}\n\`\`\`\n`;
    writeFileSync(join(dir, '.claude', 'delivery.md'), body);
  }
  // The refinement sits below the root, as refinements do: the project file is the working folder's, not the file's.
  mkdirSync(join(dir, 'docs'));
  const file = join(dir, 'docs', 'refinement.md');
  writeFileSync(file, text);
  return spawnSync(process.execPath, [join(HERE, 'check-refinement.mjs'), file], { cwd: dir, encoding: 'utf8' });
}

const PESTER = '\\.Tests\\.ps1$';
const PYTHON = '(^|/)test_[^/]*\\.py$';

test('without a provingTest, or without a project file, a proving test is judged by the default rule', () => {
  for (const project of [null, { commands: {} }]) {
    const node = inRepository(project, provedBy('tests/server.test.ts'));
    assert.equal(node.status, 0, node.stdout);
    const pester = inRepository(project, provedBy('tests/Report.Tests.ps1'));
    assert.equal(pester.status, 1, pester.stdout);
    assert.match(pester.stdout, /AC2: "Proving test" names no test file and quoted row: tests\/Report\.Tests\.ps1 "a broken place area"\r?\n/);
  }
});

test('a Pester provingTest accepts a .Tests.ps1 proving test, in backticks too, and turns down a .test.ts one by its pattern', () => {
  const project = { provingTest: PESTER };
  for (const file of ['tests/Report.Tests.ps1', '`tests/Report.Tests.ps1`']) {
    const run = inRepository(project, provedBy(file));
    assert.equal(run.status, 0, run.stdout);
  }
  const node = inRepository(project, provedBy('tests/server.test.ts'));
  assert.equal(node.status, 1);
  assert.match(node.stdout, /AC2: "Proving test" names no test file and quoted row: tests\/server\.test\.ts "a broken place area" \(the project file's provingTest is \/\\\.Tests\\\.ps1\$\/\)/);
});

test('a Python provingTest accepts test_*.py and turns down a file that only ends in .py', () => {
  const project = { provingTest: PYTHON };
  const python = inRepository(project, provedBy('tests/test_report.py'));
  assert.equal(python.status, 0, python.stdout);
  const plain = inRepository(project, provedBy('tests/report.py'));
  assert.equal(plain.status, 1);
  assert.match(plain.stdout, /AC1: "Proving test" names no test file and quoted row: tests\/report\.py/);
});

test('a provingTest that is no regular expression fails with one clear line', () => {
  const run = inRepository({ provingTest: 'tests/(' }, provedBy('tests/server.test.ts'));
  assert.equal(run.status, 1);
  assert.equal(run.stdout.trimEnd().split('\n').length, 1, run.stdout);
  assert.match(run.stdout, /^FAIL: .*delivery\.md: "provingTest" is no regular expression \(/);
  const number = inRepository({ provingTest: 42 }, provedBy('tests/server.test.ts'));
  assert.equal(number.status, 1);
  assert.equal(number.stdout.trimEnd().split('\n').length, 1, number.stdout);
  assert.match(number.stdout, /^FAIL: .*delivery\.md: "provingTest" must be a regular expression in a string/);
});

test('a project file whose json block cannot be read fails with one line that names it', () => {
  const run = inRepository('# Project\n\n```json\n{ "provingTest": \n```\n', provedBy('tests/server.test.ts'));
  assert.equal(run.status, 1);
  assert.equal(run.stdout.trimEnd().split('\n').length, 1, run.stdout);
  assert.match(run.stdout, /^FAIL: .*delivery\.md: its json block is not valid JSON/);
});

test('the project file\'s "stakeholder" lets the command line accept that name, and only in its own repository', () => {
  const byName = refinement(point(BY_NAME));
  const named = inRepository({ stakeholder: 'Dana' }, byName);
  assert.equal(named.status, 0, named.stdout);
  for (const project of [null, { commands: {} }]) {
    const run = inRepository(project, byName);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stdout, /"\(stakeholder, <date>\)"/);
  }
  const both = inRepository({ stakeholder: 'Dana', provingTest: PESTER }, refinement({
    'Acceptance criteria': provedBy('tests/Report.Tests.ps1').match(/## Acceptance criteria\n\n([\s\S]*?)\n\n## /)[1],
    'Conflicts and unclear points': BY_NAME,
  }));
  assert.equal(both.status, 0, both.stdout);
});

test('a "stakeholder" that names a team role fails, so no role can sign an AC change', () => {
  for (const value of ['Architect', 'developer', 'Builder', 'TestWriter', 'test writer', 'Reviewer', 'Scrum Master', 'product owner',
    'Deciding Architect', 'The Architect', 'Architects', 'Developers', 'Dana the Reviewer', 'Test-Writer', 'Scrum-Master']) {
    const run = inRepository({ stakeholder: value }, refinement());
    assert.equal(run.status, 1, `${value}: ${run.stdout}`);
    assert.match(run.stdout, /^FAIL: .*delivery\.md: "stakeholder" names a team role/);
  }
  const person = inRepository({ stakeholder: 'Archie' }, refinement());
  assert.equal(person.status, 0, person.stdout);
});

test('a "stakeholder" that is no name fails with one clear line', () => {
  for (const value of [42, '', '   ', '(Dana)', 'Dana|Robin', '1Dana']) {
    const run = inRepository({ stakeholder: value }, refinement());
    assert.equal(run.status, 1, `${JSON.stringify(value)}: ${run.stdout}`);
    assert.equal(run.stdout.trimEnd().split('\n').length, 1, run.stdout);
    assert.match(run.stdout, /^FAIL: .*delivery\.md: "stakeholder" must be a name/);
  }
});
