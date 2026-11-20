// Guards the plugins' design goal: the delivering-a-story skill names no project. A project's name, its source and test folders, its tools and its backlog's own words live in
// that repository's .claude/delivery.md and in the backlog adapters, never in the skill text Claude follows in every
// repository. And no file of any plugin leans on one person's setup: no memory id (a rule a skill needs is written in
// the skill), no personal name or path. Memories may tune a skill; they never carry what it needs to run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PLUGINS = join(import.meta.dirname, '..', 'plugins');
const SKILL = join(PLUGINS, 'delivery', 'skills', 'delivering-a-story');

/** What no skill file may name, each with the files allowed to name it (paths from the skill folder). */
export const TERMS = [
  { label: 'a project name (NeoCortex)', pattern: /neocortex/i, allowedIn: [] },
  { label: 'a source folder (src/)', pattern: /(?<![\w.-])src\//, allowedIn: [] },
  { label: 'a test folder (test/)', pattern: /(?<![\w.-])test\//, allowedIn: [] },
  { label: 'a type checker (tsc)', pattern: /\btsc\b/, allowedIn: [] },
  { label: 'a test runner (node --test)', pattern: /node\s+--test\b/, allowedIn: [] },
  // Azure DevOps calls a backlog item a work item; its adapter is the one file that maps the two words.
  { label: 'a backlog system\'s word (work item)', pattern: /\bwork[ -]items?\b/i, allowedIn: ['backlogs/azure-devops.md'] },
  { label: 'a personal scratch path (C:/CODE)', pattern: /C:[\\/]CODE\b/i, allowedIn: [] },
];

/** What no file of any plugin may name: one person's name, folders, tools or private rule sets. */
export const PERSONAL = [
  { label: 'a person (Remco)', pattern: /\bRemco\b/i },
  { label: 'a personal cloud folder (OneDrive)', pattern: /OneDrive/i },
  { label: 'an employer (Gridly)', pattern: /\bGridly\b/i },
  { label: 'a personal git client (GitKraken)', pattern: /GitKraken/i },
  { label: 'a private design reference (design B22)', pattern: /\bdesign B\d+\b/ },
  { label: 'a private rule set (work-rules)', pattern: /\bwork-rules\b/i },
  { label: 'a user\'s home folder (C:/Users, /Users/<name>)', pattern: /C:[\\/]Users[\\/]|\/Users\/[a-z]/i },
];
/** A memory id: eight lowercase hex characters standing alone (part of a uuid or a dashed name is none). */
export const MEMORY_ID = /(?<![\w-])[0-9a-f]{8}(?![\w-])/g;
/** A memory cited by its full uuid: the word memory or memories, then the uuid within a few words. */
export const MEMORY_UUID = /\bmemor(?:y|ies)\b[^.\n]{0,20}?([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/gi;

/** Every file below `dir`, as a path from `root` with forward slashes. */
function filesOf(dir, root = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesOf(path, root, out);
    else out.push(relative(root, path).replaceAll('\\', '/'));
  }
  return out;
}

/** Each line of `text` that names a term not allowed in `file`, as "file:line: label: the line". */
export function termHits(file, text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const { label, pattern, allowedIn } of TERMS) {
      if (!allowedIn.includes(file) && pattern.test(line)) hits.push(`${file}:${index + 1}: ${label}: ${line.trim()}`);
    }
  });
  return hits;
}

/** Each memory id in `text`, as "file:line: id". */
export function idHits(file, text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [id] of line.matchAll(MEMORY_ID)) hits.push(`${file}:${index + 1}: ${id}`);
    for (const [, uuid] of line.matchAll(MEMORY_UUID)) hits.push(`${file}:${index + 1}: ${uuid}`);
  });
  return hits;
}

/** Each line of `text` that names a personal term, as "file:line: label: the line". */
export function personalHits(file, text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const { label, pattern } of PERSONAL) if (pattern.test(line)) hits.push(`${file}:${index + 1}: ${label}: ${line.trim()}`);
  });
  return hits;
}

const FILES = filesOf(SKILL);
const read = (file) => readFileSync(join(SKILL, file), 'utf8');
const PLUGIN_FILES = filesOf(PLUGINS);
const readPlugin = (file) => readFileSync(join(PLUGINS, file), 'utf8');

test('the scan reads every file of the skill, the adapters included', () => {
  for (const file of ['SKILL.md', 'briefs.md', 'refinement-template.md', 'project-file-template.md', 'check-refinement.mjs',
    'check-refinement.test.mjs', 'check-gate.mjs', 'check-gate.test.mjs', 'backlogs/azure-devops.md', 'backlogs/github.md']) {
    assert.ok(FILES.includes(file), `${file} is not among the files the scan reads: ${FILES.join(', ')}`);
  }
});

test('each term the guard forbids is caught on a line that names it, and passes a line that does not', () => {
  const caught = [
    ['NeoCortex', 'a NeoCortex story'],
    ['src/', 'edit src/server.ts'],
    ['test/', 'grep test/ for importers'],
    ['tsc', 'npx tsc -p tsconfig.json'],
    ['node --test', 'node --test --test-concurrency=4'],
    ['work item', 'the work item\'s description'],
    ['C:/CODE', 'C:/CODE/scratch/446'],
  ];
  for (const [term, line] of caught) assert.equal(termHits('SKILL.md', line).length, 1, `"${line}" should be caught as ${term}`);
  for (const line of ['the tests/ folder', 'a .test.ts file', 'the backlog item', 'the Scrum Master runs the checks']) {
    assert.deepEqual(termHits('SKILL.md', line), [], `"${line}" names no project`);
  }
  assert.deepEqual(termHits('backlogs/azure-devops.md', 'a work item'), [], 'the Azure DevOps adapter maps the word');
  assert.equal(idHits('SKILL.md', 'memory 87c4a366 and memory b305effb').length, 2, 'every memory id is caught');
  assert.deepEqual(idHits('x.ps1', 'id: 00000001-0000-4000-8000-000000000000 and handoff-1a2b3c4d-na.md'), [], 'a uuid or a dashed name is no memory id');
  assert.equal(idHits('SKILL.md', 'see memory b305effb-82ac-41cc-b019-058ba139fdeb').length, 1, 'a memory cited by its full uuid is caught');
});

test('each personal term is caught on a line that names it, and a neutral line passes', () => {
  const caught = ['ask Remco for the GO', 'OneDrive - Gridly/Documents', 'staged in GitKraken', 'design B22 of NeoCortex',
    'G1 in the work-rules', 'C:/Users/remco/.claude', '/Users/remco/.claude'];
  for (const line of caught) assert.ok(personalHits('a.md', line).length >= 1, `"${line}" should be caught`);
  for (const line of ['ask the stakeholder for the GO', 'the user may have staged files', '~/.claude/projects']) {
    assert.deepEqual(personalHits('a.md', line), [], `"${line}" is neutral`);
  }
});

test('no file of the skill names a project, its folders, its tools or its backlog\'s words', () => {
  assert.deepEqual(FILES.flatMap((file) => termHits(file, read(file))), []);
});

test('the plugin scan reads both plugins, their scripts included', () => {
  for (const file of ['delivery/skills/delivering-a-story/SKILL.md', 'session/commands/handoff.md',
    'session/commands/endsession.md', 'session/scripts/Test-Handoff.ps1']) {
    assert.ok(PLUGIN_FILES.includes(file), `${file} is not among the files the scan reads`);
  }
});

test('no file of any plugin cites a memory id', () => {
  assert.deepEqual(PLUGIN_FILES.flatMap((file) => idHits(file, readPlugin(file))), []);
});

test('no file of any plugin names a person, a personal folder or a private rule set', () => {
  assert.deepEqual(PLUGIN_FILES.flatMap((file) => personalHits(file, readPlugin(file))), []);
});

test('the README, which is published with the plugins, cites no memory and names no person', () => {
  const readme = readFileSync(join(PLUGINS, '..', 'README.md'), 'utf8');
  assert.deepEqual([...idHits('README.md', readme), ...personalHits('README.md', readme)], []);
});

/** The panes the skill addresses, each with the visible title its launch command gives it. */
export const PANES = [
  ['architect', 'Architect'], ['developer', 'Developer'], ['tester', 'TestWriter'], ['reviewer', 'Reviewer'],
  ['scrummaster', 'ScrumMaster'],
];

/** Each pane with no launch command in `text`, and each line that sends the reader to a memory for one. */
export function launchGaps(text) {
  const missing = PANES.filter(([pane, title]) =>
    !new RegExp(`^hc run --bg --name ${pane} claude --name ${title} --model \\w+ --effort \\w+$`, 'm').test(text))
    .map(([pane]) => `no launch command for ${pane}`);
  const pointers = text.split(/\r?\n/).filter((line) => /launch commands?\b.{0,40}\bmemor(y|ies)\b/i.test(line))
    .map((line) => `launch commands only in a memory: ${line.trim()}`);
  return [...missing, ...pointers];
}

test('launchGaps catches a missing pane and a pointer to a memory, and passes a full set', () => {
  const full = PANES.map(([pane, title]) => `hc run --bg --name ${pane} claude --name ${title} --model opus --effort high`)
    .join('\n');
  assert.deepEqual(launchGaps(full), []);
  assert.deepEqual(launchGaps(full.replace(/^hc run --bg --name tester.*$/m, '')), ['no launch command for tester']);
  assert.equal(launchGaps(`${full}\n(launch commands: memory ceda10be)`).length, 1);
  assert.equal(launchGaps(`${full}\nThe launch commands are in memory ceda10be.`).length, 1);
  assert.deepEqual(launchGaps(`${full}\nThe launch commands below are the defaults.`), [], 'naming them is no pointer');
});

test('the skill carries its own launch command for every pane, not a pointer to a memory', () => {
  assert.deepEqual(launchGaps(read('SKILL.md')), []);
});
