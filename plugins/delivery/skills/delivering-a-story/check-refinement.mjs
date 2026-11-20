#!/usr/bin/env node
// Mechanical check of a story refinement written from refinement-template.md (gate 1 of the delivering-a-story skill).
// It checks declared structure, never the truth of the content, and it reads no English prose:
// - every required "## " section is present once and filled, with no {placeholder} left;
// - "User value" opens with the user story "As <role>, I want <what>, so that <why>." in its first paragraph, which may
//   wrap over lines (emphasis and a blockquote read), with the placeholders <role>, <what> and <why> filled in;
// - "Delivers value alone" starts with "yes: <reason>" or "no: no value cut exists; <reason>" and
//   holds one "Waits on:" line whose value is exactly "none" or the backlog items; a yes that waits on anything fails;
// - both tables carry the template's header, and every row has a filled cell under each column;
// - "Dimensions" names each thing that varies and every value it takes, each value covered by a scenario row, and the
//   size of the cross-product is printed as a note: a story whose product is large is one to decide about before it is
//   built (on one story three of its four fix rounds were cells of the product that no row named);
// - each AC row lists at least one scenario id (S1, S2, ...) under "Scenarios" and names its proving test file and
//   quoted row; a test file is one named *.test.js, *.test.ts or the like, unless the project file in the working
//   folder (.claude/delivery.md) sets "provingTest", a regular expression the file's path must match;
// - "States, moments and places" has one row per scenario id; each id an AC lists is a row, and each row is listed by
//   at least one AC;
// - every point (a task-list item under any list marker, blockquoted or not) sits under "Conflicts and unclear
//   points"; none is open; a resolved one reads "<point> Answer: <answer> Serves: <...> (<who>, YYYY-MM-DD)", where
//   <who> is the product owner, the stakeholder (the word "stakeholder", or the name the project file's "stakeholder"
//   sets) or, in autonomous mode, a deciding architect; an open point is answered by the product owner for a
//   what-question, by the stakeholder when the answer changes, narrows or drops an AC;
// - the estimate is 1, 2, 3, 5 or 8 points with its basis.
// What stays a judgement: whether "Waits on: none" is true, whether the scenarios are complete, whether the user story
// is the backlog item's, and whether the user story's want and each AC's criterion are outcomes the user can observe.
// Exit code 0 = PASS, 1 = FAIL with every failure listed.
//
// Usage: node <this skill's folder>/check-refinement.mjs <refinement.md>, from the repository root.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProject, PROJECT_FILE } from './check-gate.mjs';

export const REQUIRED = [
  'User value',
  'Delivers value alone',
  'Acceptance criteria',
  'Dimensions',
  'States, moments and places',
  'Conflicts and unclear points',
  'Not in this story',
  'Estimate',
];

/** A proving test's file when the project file sets no "provingTest": the cell names a *.test.js/ts/mjs/... file. */
const DEFAULT_TEST_FILE = /\S+\.test\.[cm]?[jt]s\b/;
const POINTS = [1, 2, 3, 5, 8];
const MIN_REASON = 20;
const MIN_ANSWER = 10;
const CONFLICTS = 'Conflicts and unclear points';
const DIMENSIONS = 'Dimensions';
const STATES = 'States, moments and places';
const SCENARIO_ID = /^S\d+$/;
/** A task-list item under any marker: "-", "*", "+" or a number, also inside a blockquote; `[ ]` open, `[x]` resolved. */
const CHECKBOX = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/;
const OPEN = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[ \]/;
const RESOLVED = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[xX]\]\s*/;
const AC_COLUMNS = ['AC', 'Criterion', 'Scenarios', 'Proving test'];
const DIMENSION_COLUMNS = ['Dimension', 'Values', 'Rows'];
const STATE_COLUMNS = ['Id', 'State, moment or place', 'Operation', 'Expected'];
/** The stakeholder's tag when the project file names nobody: the person who decides an AC change and gives the GO. */
export const DEFAULT_STAKEHOLDER = 'stakeholder';
/** A stakeholder's name as a tag "(<name>, <date>)" can hold it: a letter first, then letters, spaces, . ' or -. */
const STAKEHOLDER_NAME = /^\p{L}[\p{L} .'-]*$/u;
/** Team roles, which never sign as the stakeholder: the proposer or the builder would then decide its own point. */
const TEAM_ROLES = /\b(?:product owners?|architects?|developers?|builders?|test[ -]?writers?|testers?|reviewers?|scrum[ -]?masters?)\b/i;

/**
 * Who may resolve a point: the product owner for a what-question, the stakeholder for an AC change, and a deciding
 * architect in autonomous mode -- never the refining architect alone, never the builder. The stakeholder signs as
 * "stakeholder" or by the name the project file sets.
 */
export function deciderPattern(stakeholder) {
  const names = ['product owner', 'deciding architect', DEFAULT_STAKEHOLDER];
  if (stakeholder) names.push(stakeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\((?:${names.join('|')}),\\s*\\d{4}-\\d{2}-\\d{2}\\)\\s*$`, 'iu');
}

/** The text without fenced code blocks and HTML comments, whose lines are no content and whose "## " no heading. */
function visible(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
}

/** The "## " sections in order, each with its title and its trimmed body. */
function sectionsOf(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = { title: heading[1], lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() })); // not shown: a refinement's heading
}

/** Template text left in a body: a {placeholder} in braces, outside code spans. */
function placeholderIn(body) {
  const match = /\{[a-z0-9][^{}\n]*\}/.exec(body.replace(/`[^`\n]*`/g, ''));
  return match ? match[0] : null;
}

/** The cells of a table line, split on pipes that are not escaped: an escaped "\|" stays inside its cell. */
function cellsOf(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

/** The markdown table in a body: its header cells and its data rows; the separator line dropped. */
function tableOf(body) {
  const lines = body.split('\n').filter((line) => line.trim().startsWith('|'));
  return {
    header: lines.length ? cellsOf(lines[0]) : [],
    rows: lines
      .slice(1)
      .filter((line) => !/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line))
      .map(cellsOf),
  };
}

/** A table's header must be the template's, and each row must have as many cells: an absent cell is no filled one. */
function checkShape(title, { header, rows }, columns, fail) {
  if (header.length && header.join('|').toLowerCase() !== columns.join('|').toLowerCase()) {
    fail(`"${title}": the header must be "${columns.join(' | ')}"`);
  }
  for (const row of rows) {
    if (row.length !== columns.length) fail(`"${title}": the row "${row.join(' | ')}" has ${row.length} cells, not ${columns.length}`);
  }
}

/** The user story: "As <role>, I want <what>, so that <why>"; the comma after the role and before "so that" optional. */
const USER_STORY = /^As\s+\S.*?,?\s+I want\s+\S.*?,?\s+so that\s+\S/i;

/**
 * Contract U: the first paragraph of "User value" is the user story, the sentence that opens the backlog item's
 * description. A paragraph may wrap over several lines, blockquoted or not; it ends at the first blank line.
 */
function checkUserValue(body, fail) {
  const lines = body.split('\n').map((line) => line.trim().replace(/^(?:>\s*)+/, '').trim());
  const end = lines.indexOf('');
  const story = (end < 0 ? lines : lines.slice(0, end)).join(' ').replace(/[*_]/g, '');
  if (!USER_STORY.test(story)) {
    fail('"User value" must open with the user story: "As <role>, I want <what>, so that <why>."');
  } else if (/<(?:role|what|why)>/i.test(story)) {
    fail('"User value" still holds the placeholder user story: fill in <role>, <what> and <why>');
  }
}

/** Contract V: yes or "no: no value cut exists" on the first line (emphasis and dashes read), then "Waits on:". */
function checkValueAlone(body, fail) {
  // Emphasis around yes or no, with at most one separator inside it ("**yes:**", "**Yes,**", "**Yes —**"), reads as
  // yes or no followed by that separator.
  const first = body.split('\n')[0].trim().replace(/^([*_]{1,2})(yes|no)(\s*[:,;\-–—]?)\1/i, '$2$3');
  const yes = /^yes\b/i.test(first);
  if (/^no\b/i.test(first)) {
    // A story that shows the user nothing is allowed only when no value cut exists, and says why.
    const noCut = /^no\b[\s:;,\-–—]*no value cut exists\b[\s:;,.\-–—]*(.*)$/i.exec(first);
    if (!noCut) {
      fail('"Delivers value alone" is no: combine this story with the stories that make it valuable, then refine the combination; only when no value cut exists, write "no: no value cut exists; <why>"');
    } else if (noCut[1].trim().length < MIN_REASON) {
      fail(`"Delivers value alone": "no value cut exists" needs its reason of at least ${MIN_REASON} characters`);
    }
  } else if (!yes) {
    fail('"Delivers value alone" must start with yes or no');
  } else if (first.replace(/^yes\b[\s:,\-–—]*/i, '').length < 10) {
    fail('"Delivers value alone" needs its reason after yes');
  }
  // One "Waits on:" line, whose value is exactly "none" or the backlog items: "none until #433 lands" waits on #433.
  const waits = body.split('\n').map((line) => line.trim()).filter((line) => /^Waits on:/i.test(line));
  if (waits.length > 1) fail(`"Delivers value alone": "Waits on:" appears ${waits.length} times`);
  const on = waits.length ? waits[0].replace(/^Waits on:/i, '').trim() : '';
  if (!on) {
    fail('"Delivers value alone" needs a "Waits on:" line: none, or the backlog items its value waits on');
  } else if (yes && !/^none\.?$/i.test(on)) {
    fail(`"Delivers value alone": a yes that waits on ${on} is a no: combine this story with what it waits on, or write "no: no value cut exists; <why>"`);
  }
}

/** The file part of a "Proving test" cell: its text before the quoted row, without code-span backticks. */
const provingPath = (cell) => {
  const end = cell.indexOf('"');
  return (end < 0 ? cell : cell.slice(0, end)).trim().replace(/^`+|`+$/g, '').trim();
};

/**
 * Contract S, the AC half: each AC row lists scenario ids and names a proving test file and quoted row. Without a
 * `provingTest` the file is found anywhere in the cell by the default rule, exactly as before the project file had a
 * say; with one, the cell's file part must match it.
 */
function checkCriteria(body, fail, _note, { provingTest } = {}) {
  const table = tableOf(body);
  const { rows } = table;
  const criteria = [];
  if (rows.length === 0) {
    fail('"Acceptance criteria" has no AC rows');
    return criteria;
  }
  checkShape('Acceptance criteria', table, AC_COLUMNS, fail);
  const seen = new Map();
  for (const row of rows) {
    const id = row[0] ?? '';
    const scenarios = row[2] ?? '';
    const ids = scenarios.split(/[\s,;]+/).filter(Boolean);
    if (!/^AC\d+$/.test(id)) fail(`"Acceptance criteria": "${id}" is no AC id (AC1, AC2, ...)`);
    else {
      seen.set(id, (seen.get(id) ?? 0) + 1);
      criteria.push({ id, ids: ids.filter((token) => SCENARIO_ID.test(token)) });
    }
    AC_COLUMNS.forEach((column, index) => {
      if (index > 0 && !(row[index] ?? '')) fail(`"Acceptance criteria": ${id || 'a row'}: "${column}" is empty`);
    });
    if (scenarios && !ids.every((token) => SCENARIO_ID.test(token))) {
      fail(`"Acceptance criteria": ${id || 'a row'}: "Scenarios" must list scenario ids (S1, S2, ...), each a row under "${STATES}": ${scenarios}`);
    } else if (scenarios && ids.length === 0) {
      fail(`"Acceptance criteria": ${id || 'a row'} lists no scenario id (S1, S2, ...): ${scenarios}`);
    }
    const proving = row[3] ?? '';
    const named = provingTest ? provingTest.test(provingPath(proving)) : DEFAULT_TEST_FILE.test(proving);
    if (proving && !(named && /"[^"]+"/.test(proving))) {
      const rule = provingTest ? ` (the project file's provingTest is /${provingTest.source}/)` : '';
      fail(`"Acceptance criteria": ${id || 'a row'}: "Proving test" names no test file and quoted row: ${proving}${rule}`);
    }
  }
  for (const [id, count] of seen) if (count > 1) fail(`"Acceptance criteria": ${id} appears ${count} times`);
  return criteria;
}

/**
 * Contract X, the cross-product: every value a dimension names is covered by at least one scenario row, and the size
 * of the product is reported. A value no row names is a bug waiting for the reviewer to find it -- one story's way-out
 * rule covered updates and nothing covered a save or a promote, and three of its four fix rounds were
 * those cells. The row ids are not cross-checked against the states table here: checkLinks does that.
 */
function checkDimensions(body, fail, note) {
  const text = body.trim();
  if (/^None\b/i.test(text)) {
    const reason = /^None\b:?\s*([\s\S]*)$/i.exec(text)?.[1]?.trim() ?? '';
    if (reason.length < MIN_REASON) {
      fail(`"${DIMENSIONS}": "None" needs a reason of at least ${MIN_REASON} characters: a story with one value per dimension says why`);
    }
    return;
  }
  const table = tableOf(body);
  if (table.rows.length === 0) {
    fail(`"${DIMENSIONS}" has no rows: name each thing that varies and every value it takes`);
    return;
  }
  checkShape(DIMENSIONS, table, DIMENSION_COLUMNS, fail);
  let product = 1;
  const counted = [];
  for (const row of table.rows) {
    const [dimension = '', values = '', ids = ''] = row;
    if (row.some((cell) => !cell)) fail(`"${DIMENSIONS}": the row "${row.join(' | ')}" has an empty cell`);
    const list = values.split(/[,;]+/).map((value) => value.trim()).filter(Boolean);
    if (list.length < 2) {
      fail(`"${DIMENSIONS}": ${dimension || 'a row'} names ${list.length === 0 ? 'no value' : `one value (${list[0]})`}: a dimension that varies once is no dimension, so leave it out`);
      continue;
    }
    product *= list.length;
    counted.push(`${dimension || '?'} ${list.length}`);
    const covered = ids.split(/[\s,;]+/).filter((token) => SCENARIO_ID.test(token));
    if (covered.length === 0) {
      fail(`"${DIMENSIONS}": ${dimension || 'a row'} names no scenario row: "${ids}" holds no S<n>`);
    } else if (covered.length < list.length) {
      // Not a failure: one row may cover a value another dimension's row also covers ("readable" comes with every
      // moment's row). It is a note because the count is the cheapest signal that a value was never thought through --
      // and a value with NO row at all did fail above, which is what that story's uncovered promote did.
      note(`"${DIMENSIONS}": ${dimension || 'a row'} has ${list.length} values and ${covered.length} row(s): a value no row names is the cell a reviewer finds later`);
    }
  }
  if (counted.length > 0) note(`"${DIMENSIONS}": the cross-product is ${product} cells (${counted.join(' x ')})`);
}

/** Contract S, the states half: one row per scenario id, every cell filled; returns the ids of the rows. */
function checkStates(body, fail) {
  const table = tableOf(body);
  const { rows } = table;
  const ids = new Map();
  if (rows.length === 0) {
    fail(`"${STATES}" has no rows: write one row per scenario, its "Id" listed under an AC's "Scenarios"`);
    return ids;
  }
  checkShape(STATES, table, STATE_COLUMNS, fail);
  for (const row of rows) {
    if (row.some((cell) => !cell)) fail(`"${STATES}": the row "${row.join(' | ')}" has an empty cell`);
    const id = row[0] ?? '';
    if (!SCENARIO_ID.test(id)) fail(`"${STATES}": "${id}" is no scenario id (S1, S2, ...)`);
    else ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) fail(`"${STATES}": ${id} appears ${count} times`);
  return ids;
}

/** Contract S, the links: each id an AC lists is a row, and each row is listed by at least one AC. */
function checkLinks(criteria, rowIds, fail) {
  const listed = new Set();
  for (const { id, ids } of criteria) {
    for (const scenario of ids) {
      listed.add(scenario);
      if (!rowIds.has(scenario)) fail(`"${STATES}": ${id} lists ${scenario}, which is no row`);
    }
  }
  for (const scenario of rowIds.keys()) if (!listed.has(scenario)) fail(`"${STATES}": ${scenario} is in no AC's "Scenarios"`);
}

/** Contract P: no open point; a resolved one reads "<point> Answer: <answer> Serves: <...> (<who>, <date>)". */
function checkConflicts(body, fail, _note, { stakeholder } = {}) {
  const decidedBy = deciderPattern(stakeholder);
  const who = stakeholder ? `the stakeholder (${stakeholder})` : 'the stakeholder';
  const open = body.split('\n').filter((line) => OPEN.test(line));
  for (const line of open) {
    fail(`"${CONFLICTS}": open point: the product owner answers a what-question, and ${who} when the answer changes, narrows or drops an AC; the refining architect never resolves its own: ${line.trim()}`);
  }
  const resolved = body.split('\n').filter((line) => RESOLVED.test(line));
  for (const line of resolved) {
    const shown = line.trim();
    const text = line.replace(RESOLVED, '');
    const answerAt = text.search(/\bAnswer:/);
    const servesAt = text.search(/\bServes:/);
    if (answerAt < 0) {
      fail(`"${CONFLICTS}": resolved point without "Answer: <answer>": ${shown}`);
    } else {
      if (!text.slice(0, answerAt).trim()) fail(`"${CONFLICTS}": resolved point without its point before "Answer:": ${shown}`);
      const end = servesAt > answerAt ? servesAt : undefined;
      const answer = text.slice(answerAt + 'Answer:'.length, end).replace(decidedBy, '').trim();
      if (answer.length < MIN_ANSWER) fail(`"${CONFLICTS}": resolved point needs an answer of at least ${MIN_ANSWER} characters after "Answer:": ${shown}`);
    }
    const serves = servesAt >= 0 && (answerAt < 0 || servesAt > answerAt) ? text.slice(servesAt + 'Serves:'.length).replace(decidedBy, '').trim() : '';
    if (!serves) fail(`"${CONFLICTS}": resolved point without "Serves: <the decision or guardrail it reflects, or own judgement>" after its answer: ${shown}`);
    if (!decidedBy.test(line)) fail(`"${CONFLICTS}": resolved point without "(product owner, <date>)", "(${stakeholder ?? DEFAULT_STAKEHOLDER}, <date>)" or "(deciding architect, <date>)" at its end: ${shown}`);
  }
  if (open.length === 0 && resolved.length === 0) {
    const none = /^None\b:?\s*(.*)$/i.exec(body);
    if (!none || none[1].trim().length < MIN_REASON) fail(`"${CONFLICTS}": "None" needs a reason of at least ${MIN_REASON} characters, or list the points`);
  }
}

/** A point, open or resolved, anywhere but under "Conflicts and unclear points" escapes its checks: fail it. */
function checkStrayPoints(text, fail) {
  let title = null;
  for (const line of text.split('\n')) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading) title = heading[1];
    else if (title !== CONFLICTS && CHECKBOX.test(line)) {
      fail(`"${title ?? 'the title'}": a point belongs under "${CONFLICTS}": ${line.trim()}`);
    }
  }
}

function checkEstimate(body, fail) {
  const points = /\b(\d+)\s+(?:story\s+)?points?\b/i.exec(body);
  if (!points) fail('"Estimate" names no points');
  else {
    const n = Number(points[1]);
    if (n > 8) fail(`"Estimate": ${n} points is above 8: split it by user value`);
    else if (!POINTS.includes(n)) fail(`"Estimate": ${n} is no Fibonacci point (1, 2, 3, 5 or 8)`);
  }
  const basis = /Basis:\s*(.*)$/im.exec(body);
  if (!basis || basis[1].trim().length < 10) fail('"Estimate" needs "Basis:" with what it counts (files, contracts, rows, lines)');
}

const CHECKS = {
  'User value': checkUserValue,
  'Delivers value alone': checkValueAlone,
  'Acceptance criteria': checkCriteria,
  [DIMENSIONS]: checkDimensions,
  [STATES]: checkStates,
  [CONFLICTS]: checkConflicts,
  Estimate: checkEstimate,
};

/**
 * Every failure of a refinement's text, and the notes that only inform (the cross-product's size); no failure is a PASS.
 * `options.provingTest`, a RegExp, is the project file's rule for a proving test's file; without it the default holds.
 * `options.stakeholder` is the name the stakeholder may sign a resolved point with, beside "stakeholder".
 */
export function checkRefinement(text, options = {}) {
  const failures = [];
  const notes = [];
  const fail = (message) => {
    failures.push(message);
  };
  const note = (message) => {
    notes.push(message);
  };
  const shown = visible(text);
  const sections = sectionsOf(shown);
  const results = {};
  checkStrayPoints(shown, fail);
  for (const title of REQUIRED) {
    const found = sections.filter((s) => s.title === title); // not shown: a refinement's heading
    if (found.length === 0) {
      fail(`"${title}" is missing`);
      continue;
    }
    if (found.length > 1) fail(`"${title}" appears ${found.length} times`);
    const { body } = found[0];
    if (!body) {
      fail(`"${title}" is empty`);
      continue;
    }
    const placeholder = placeholderIn(body);
    if (placeholder) fail(`"${title}" still holds template text: ${placeholder}`);
    results[title] = CHECKS[title]?.(body, fail, note, options);
  }
  if (results['Acceptance criteria'] && results[STATES]) checkLinks(results['Acceptance criteria'], results[STATES], fail);
  return { failures, notes };
}

/**
 * The project file's options, from `.claude/delivery.md` in `root`: `provingTest` (a RegExp) and `stakeholder` (a
 * name) for each key it sets, `{}` when the file or both keys are absent (the defaults hold), or `{ error }` in one line
 * when the file cannot be read, its "provingTest" is no regular expression or its "stakeholder" is no name.
 */
export function projectOptions(root) {
  const path = join(root, PROJECT_FILE);
  if (!existsSync(path)) return {};
  const { config, error } = parseProject(readFileSync(path, 'utf8'));
  if (error) return { error: `${path}: ${error}` };
  if (!config || typeof config !== 'object') return {};
  const options = {};
  if ('provingTest' in config) {
    const source = config.provingTest;
    if (typeof source !== 'string' || source.trim() === '') return { error: `${path}: "provingTest" must be a regular expression in a string` };
    try {
      options.provingTest = new RegExp(source);
    } catch (caught) {
      return { error: `${path}: "provingTest" is no regular expression (${caught.message})` };
    }
  }
  if ('stakeholder' in config) {
    const name = typeof config.stakeholder === 'string' ? config.stakeholder.trim() : '';
    if (!STAKEHOLDER_NAME.test(name)) return { error: `${path}: "stakeholder" must be a name: a letter first, then letters, spaces, . ' or -` };
    if (TEAM_ROLES.test(name)) return { error: `${path}: "stakeholder" names a team role ("${name}"): a role never decides a change to an AC` };
    options.stakeholder = name;
  }
  return options;
}

function main(argv) {
  const file = argv[2];
  if (!file) {
    console.log('FAIL: usage: node check-refinement.mjs <refinement.md>');
    return 1;
  }
  const options = projectOptions(process.cwd());
  if (options.error) {
    console.log(`FAIL: ${options.error}`);
    return 1;
  }
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    console.log(`FAIL: ${file} cannot be read (${error.message})`);
    return 1;
  }
  const { failures, notes } = checkRefinement(text, options);
  if (failures.length === 0) {
    console.log(`PASS: ${file}`);
    for (const note of notes) console.log(`  note: ${note}`);
    return 0;
  }
  console.log(`FAIL: ${file}`);
  for (const failure of failures) console.log(`  - ${failure}`);
  for (const note of notes) console.log(`  note: ${note}`);
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv);
