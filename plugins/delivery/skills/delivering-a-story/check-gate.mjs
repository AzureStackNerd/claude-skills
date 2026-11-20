#!/usr/bin/env node
// The gate-3 check of the delivering-a-story skill (SKILL.md, the product owner's step 5; briefs.md, brief 6): the
// checks a run of the touched test files cannot make, driven by the repository's own project file.
//
//   node <this skill's folder>/check-gate.mjs [--suite]
//
// Run it with the repository root as the working folder. It reads `.claude/delivery.md` there, takes its one fenced
// `json` block, and runs `commands.quick` in order, stopping at the first failure. With --suite it then runs
// `commands.suite` and requires its pass line, because an exit code 0 alone has proved nothing before: a test runner
// started inside another one, or given a skip pattern through the environment, runs no test and still exits 0. It
// prints `PASS: <check>` per check that passed, `FAIL: <check>` with the reason for the one that failed, and exits 0
// or 1. A failing command's whole output goes to a log whose path it prints, so nobody re-runs a long suite to read it.
//
// A quick check is one of three kinds (project-file-template.md documents them with an example):
// - `run`: a shell command that passes on exit code 0, and, when it has a `passLine`, only if that regular expression
//   matches its output (colour codes removed, line ends normalised, multi-line mode);
// - `forbid`: no file under the listed folders, with one of the listed extensions, holds a listed pattern (a disabled
//   test row, say); a scan that reads no file fails, since it proved nothing;
// - `untracked`: no file git does not track and does not ignore has one of the listed extensions (a scratch script
//   left in the clone). Ignored paths are left out on purpose: a dependency folder ships scripts of its own.
// Node's standard library only, so a fresh install runs it as it is.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_FILE = '.claude/delivery.md';
const KINDS = ['run', 'forbid', 'untracked'];
const DEFAULT_SKIP = ['node_modules', '.git'];
const DEFAULT_TIMEOUT_MINUTES = 10;
const TAIL_LINES = 30;
/** Colour and cursor codes: Pester, for one, writes them even into a pipe (measured with Pester 6.2.0). */
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** Output as a check reads it: colour codes removed and every line end a bare newline. */
export const plain = (text) => text.replace(ANSI, '').replace(/\r\n?/g, '\n');

/**
 * The project file's one fenced `json` block, parsed: `{ config }`, or `{ error }` naming what is wrong. A fence is
 * three or more backticks or tildes, and its info string's first word must be `json`.
 */
export function parseProject(text) {
  const blocks = [];
  const fence = /^(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;
  for (const match of plain(text).matchAll(fence)) {
    if (match[2].trim().split(/\s+/)[0].toLowerCase() === 'json') blocks.push(match[3]);
  }
  if (blocks.length === 0) return { error: `it has no fenced json block` };
  if (blocks.length > 1) return { error: `it has ${blocks.length} fenced json blocks; it must have exactly one` };
  try {
    return { config: JSON.parse(blocks[0]) };
  } catch (error) {
    return { error: `its json block is not valid JSON (${error.message})` };
  }
}

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);

/** A regular expression from the project file, or the reason it does not compile. */
function compile(source, flags) {
  try {
    return { regex: new RegExp(source, flags) };
  } catch (error) {
    return { error: error.message };
  }
}

/** Every problem with one check's shape, as "commands.quick[2] (name): what"; none means it can run. */
function checkShape(check, where) {
  if (check === null || typeof check !== 'object' || Array.isArray(check)) return [`${where} is not an object`];
  const at = isText(check.name) ? `${where} (${check.name})` : where;
  const problems = isText(check.name) ? [] : [`${where} has no name`];
  const kinds = KINDS.filter((kind) => kind in check);
  if (kinds.length !== 1) {
    problems.push(`${at} must have exactly one of ${KINDS.join(', ')}; it has ${kinds.length === 0 ? 'none' : kinds.join(', ')}`);
    return problems;
  }
  if (kinds[0] === 'run') {
    if (!isText(check.run)) problems.push(`${at}: "run" must be a command`);
    if ('passLine' in check) {
      const { error } = isText(check.passLine) ? compile(check.passLine, 'm') : { error: 'it is empty' };
      if (error) problems.push(`${at}: "passLine" is no regular expression (${error})`);
    }
    if ('unsetEnv' in check && !isTextList(check.unsetEnv)) problems.push(`${at}: "unsetEnv" must list variable names`);
    if ('timeoutMinutes' in check && !(typeof check.timeoutMinutes === 'number' && check.timeoutMinutes > 0)) {
      problems.push(`${at}: "timeoutMinutes" must be a number above 0`);
    }
  } else if (kinds[0] === 'forbid') {
    const forbid = check.forbid ?? {};
    if (!isTextList(forbid.in)) problems.push(`${at}: "forbid.in" must list the folders to scan`);
    if (!isTextList(forbid.extensions)) problems.push(`${at}: "forbid.extensions" must list file extensions`);
    if ('skip' in forbid && !isTextList(forbid.skip)) problems.push(`${at}: "forbid.skip" must list folder names`);
    const patterns = forbid.patterns;
    if (patterns === null || typeof patterns !== 'object' || Array.isArray(patterns) || Object.keys(patterns).length === 0) {
      problems.push(`${at}: "forbid.patterns" must map a label to a regular expression`);
    } else {
      for (const [label, source] of Object.entries(patterns)) {
        const { error } = isText(source) ? compile(source, 'g') : { error: 'it is empty' };
        if (error) problems.push(`${at}: pattern "${label}" is no regular expression (${error})`);
      }
    }
  } else if (!isTextList(check.untracked?.extensions)) {
    problems.push(`${at}: "untracked.extensions" must list file extensions`);
  }
  return problems;
}

/** Every problem with the commands this script runs; an empty list means the project file can drive it. */
export function validate(config) {
  const commands = config?.commands;
  if (commands === null || typeof commands !== 'object' || Array.isArray(commands)) return ['"commands" is missing or not an object'];
  const problems = [];
  if (!Array.isArray(commands.quick) || commands.quick.length === 0) {
    problems.push('"commands.quick" must list at least one check: without one, a quick run proves nothing');
  } else {
    commands.quick.forEach((check, index) => problems.push(...checkShape(check, `commands.quick[${index}]`)));
  }
  if (!isText(commands.tests)) problems.push('"commands.tests" must be the command that runs named test files');
  if (!isText(commands.row)) {
    problems.push('"commands.row" must be the command that runs one row of a test file; a tool with no name filter puts its one-file command there');
  }
  if (commands.suite === undefined) {
    problems.push('"commands.suite" is missing: the whole suite with its pass line');
  } else {
    problems.push(...checkShape(commands.suite, 'commands.suite'));
    if (commands.suite && typeof commands.suite === 'object' && !('run' in commands.suite)) {
      problems.push('commands.suite must be a "run" check');
    } else if (commands.suite && !isText(commands.suite.passLine)) {
      problems.push('commands.suite needs a "passLine": an exit code 0 alone proves no test ran');
    }
  }
  return problems;
}

/** The environment for a command, without the variables it unsets; Windows names match in any case. */
function environmentWithout(names = []) {
  const drop = new Set(names.map((name) => name.toUpperCase()));
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !drop.has(key.toUpperCase())));
}

/** The last lines of an output, indented for the report. */
const tail = (text) => text.trimEnd().split('\n').slice(-TAIL_LINES).map((line) => `  ${line}`).join('\n');

/** Writes a failing command's whole output where the report can point to it. */
function saveLog(name, text) {
  const file = join(tmpdir(), `check-gate-${Date.now()}-${name.replace(/[^\w.-]+/g, '-').slice(0, 40)}.log`);
  writeFileSync(file, text);
  return file;
}

/** A `run` check: `{ ok, lines }`, where `lines` is what the report prints under its PASS or FAIL. */
function runCommand(check, root) {
  const minutes = check.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
  const result = spawnSync(check.run, {
    cwd: root,
    shell: true,
    env: environmentWithout(check.unsetEnv),
    encoding: 'utf8',
    timeout: Math.round(minutes * 60_000),
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  const output = plain(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  const failed = (reason) => ({ ok: false, lines: `  ${reason}\n${tail(output) || '  (the command printed nothing)'}\n  full output: ${saveLog(check.name, output)}` });
  if (result.error?.code === 'ETIMEDOUT') return failed(`timed out after ${minutes} minute(s): ${check.run}`);
  if (result.error) return failed(`did not run (${result.error.message}): ${check.run}`);
  if (result.status !== 0) return failed(`exit ${result.status ?? `signal ${result.signal}`}: ${check.run}`);
  if (check.passLine) {
    const matches = [...output.matchAll(new RegExp(check.passLine, 'gm'))];
    if (matches.length === 0) return failed(`exit 0, but its output has no line matching the pass line /${check.passLine}/: no test may have run`);
    return { ok: true, lines: `  pass line: ${matches.at(-1)[0].split('\n').join(' / ')}` };
  }
  return { ok: true, lines: '' };
}

/** Every file below `dir` whose extension is listed, as a path from `root` with forward slashes. */
function walk(dir, root, extensions, skip, out = []) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, root, extensions, skip, out);
    else if (extensions.some((extension) => entry.endsWith(extension))) out.push(relative(root, path).replaceAll('\\', '/'));
  }
  return out;
}

/** A `forbid` check: each file and pattern label it hits, with the count. */
function scanForbidden({ forbid }, root) {
  const skip = new Set(forbid.skip ?? DEFAULT_SKIP);
  const missing = forbid.in.filter((folder) => !existsSync(join(root, folder)));
  if (missing.length) return { ok: false, lines: `  ${missing.join(', ')}: no such folder, so the scan proves nothing` };
  const files = forbid.in.flatMap((folder) => walk(join(root, folder), root, forbid.extensions, skip));
  if (files.length === 0) return { ok: false, lines: `  scanned no file (${forbid.extensions.join(', ')} under ${forbid.in.join(', ')}): the scan proves nothing` };
  const hits = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const [label, source] of Object.entries(forbid.patterns)) {
      const count = text.match(new RegExp(source, 'g'))?.length ?? 0;
      if (count > 0) hits.push(`  ${file}: ${label} (${count})`);
    }
  }
  return hits.length ? { ok: false, lines: hits.join('\n') } : { ok: true, lines: `  scanned ${files.length} file(s)` };
}

/** An `untracked` check: each file git would commit that has a listed extension. */
function scanUntracked({ untracked }, root) {
  const result = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    return { ok: false, lines: `  git ls-files failed (${result.error?.message ?? `exit ${result.status}`}): ${plain(result.stderr ?? '').trim()}` };
  }
  const kept = result.stdout.split('\0').filter((file) => untracked.extensions.some((extension) => file.endsWith(extension)));
  if (kept.length === 0) return { ok: true, lines: '' };
  return { ok: false, lines: kept.map((file) => `  ${file}: git does not track it, so it is a scratch file; keep it outside the clone or commit it`).join('\n') };
}

function runCheck(check, root) {
  if ('run' in check) return runCommand(check, root);
  if ('forbid' in check) return scanForbidden(check, root);
  return scanUntracked(check, root);
}

/** Runs the checks for `argv` in `root`, writes the report through `write`, and returns the exit code. */
export function main(argv, root, write = (text) => process.stdout.write(text)) {
  const unknown = argv.filter((arg) => arg !== '--suite');
  if (unknown.length) {
    write(`FAIL: usage: node check-gate.mjs [--suite]; unknown argument ${unknown.join(' ')}\n`);
    return 1;
  }
  const file = resolve(root, PROJECT_FILE);
  if (!existsSync(file)) {
    write(`FAIL: no project file: ${file} does not exist; write it from project-file-template.md in this skill's folder\n`);
    return 1;
  }
  const { config, error } = parseProject(readFileSync(file, 'utf8'));
  const problems = error ? [error] : validate(config);
  if (problems.length) {
    write(`FAIL: project file ${file}:\n${problems.map((problem) => `  ${problem}`).join('\n')}\n`);
    return 1;
  }
  const checks = [...config.commands.quick, ...(argv.includes('--suite') ? [config.commands.suite] : [])];
  for (const check of checks) {
    const { ok, lines } = runCheck(check, root);
    write(`${ok ? 'PASS' : 'FAIL'}: ${check.name}\n${lines ? `${lines}\n` : ''}`);
    if (!ok) return 1;
  }
  if (!argv.includes('--suite')) write(`note: the whole suite (${config.commands.suite.name}) did not run; add --suite\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2), process.cwd());
}
