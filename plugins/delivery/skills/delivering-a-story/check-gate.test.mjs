// Tests for check-gate.mjs. Run them with Node's built-in test runner; the repository README gives the command. Each
// test builds a scratch repository with its own .claude/delivery.md and small node scripts as its commands, so no test
// depends on a real project's tools.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { main, parseProject, PROJECT_FILE, validate } from './check-gate.mjs';

const SCRIPT = join(import.meta.dirname, 'check-gate.mjs');
const NODE_PASS_LINE = '^ℹ pass [1-9]\\d*\\nℹ fail 0$';

/** Small scripts the commands below run, by name. */
const SCRIPTS = {
  'ok.mjs': "process.stdout.write('fine\\n');\n",
  'fail.mjs': "process.stdout.write('line one\\nboom\\n'); process.exit(3);\n",
  'marker.mjs': "import { writeFileSync } from 'node:fs'; writeFileSync('ran.txt', 'x');\n",
  'probe-env.mjs': "process.stdout.write(`probe ${process.env.DELIVERY_PROBE ?? 'unset'}\\n`); process.exit(process.env.DELIVERY_PROBE ? 1 : 0);\n",
  'sleep.mjs': 'setTimeout(() => {}, 3000);\n',
};

/** A project file's config: one passing quick check and a suite, with `commands` fields replaced. */
const config = (commands = {}) => ({
  commands: {
    quick: [{ name: 'quick one', run: 'node ok.mjs' }],
    tests: 'node ok.mjs {files}',
    row: 'node ok.mjs {files} {row}',
    suite: { name: 'whole suite', run: 'node suite.mjs', passLine: NODE_PASS_LINE },
    ...commands,
  },
});

/** The project file's text around a json block. */
const projectText = (json) => `# Project\n\nThe end state.\n\n\`\`\`json\n${json}\n\`\`\`\n`;

/** A scratch repository: the helper scripts, `files` (path to text), and the project file unless it is null. */
function repo(project, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-gate-'));
  for (const [path, text] of Object.entries({ ...SCRIPTS, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (project !== null) {
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(join(root, PROJECT_FILE), typeof project === 'string' ? project : projectText(JSON.stringify(project, null, 2)));
  }
  return root;
}

/** Runs the checks in `root` and returns the exit code and the report. */
function check(root, argv = []) {
  let out = '';
  const code = main(argv, root, (text) => {
    out += text;
  });
  return { code, out };
}

/** A suite script that prints `text` and exits with `exit`. */
const suite = (text, exit = 0) => `process.stdout.write(${JSON.stringify(text)}); process.exit(${exit});\n`;

test('a repository without the project file fails with one line that names the file', () => {
  const root = repo(null);
  const { code, out } = check(root);
  assert.equal(code, 1);
  assert.equal(out.trimEnd().split('\n').length, 1, out);
  assert.match(out, /^FAIL: no project file: .*delivery\.md does not exist/);
  assert.ok(out.includes(join(root, '.claude', 'delivery.md')), out);
});

test('a project file without a json block fails, and so does one with two', () => {
  const none = check(repo('# Project\n\nNo commands here.\n'));
  assert.equal(none.code, 1);
  assert.match(none.out, /it has no fenced json block/);
  const json = JSON.stringify(config());
  const two = check(repo(`${projectText(json)}\n${projectText(json)}`));
  assert.equal(two.code, 1);
  assert.match(two.out, /it has 2 fenced json blocks; it must have exactly one/);
});

test('a json block that is not valid JSON fails and says so', () => {
  const { code, out } = check(repo(projectText('{ "commands": { "quick": [ }')));
  assert.equal(code, 1);
  assert.match(out, /its json block is not valid JSON/);
});

test('a malformed check fails the project file before any command runs', () => {
  const root = repo(config({ quick: [{ name: 'marks', run: 'node marker.mjs' }, { name: 'no kind' }, { name: 'two kinds', run: 'node ok.mjs', untracked: { extensions: ['.mjs'] } }] }));
  const { code, out } = check(root);
  assert.equal(code, 1);
  assert.match(out, /commands\.quick\[1\] \(no kind\) must have exactly one of run, forbid, untracked; it has none/);
  assert.match(out, /commands\.quick\[2\] \(two kinds\) must have exactly one of run, forbid, untracked; it has run, untracked/);
  assert.equal(existsSync(join(root, 'ran.txt')), false, 'no command may run while the project file is malformed');
});

test('a suite without a pass line, or with one that does not compile, fails the project file', () => {
  const missing = check(repo(config({ suite: { name: 'whole suite', run: 'node ok.mjs' } })));
  assert.equal(missing.code, 1);
  assert.match(missing.out, /commands\.suite needs a "passLine": an exit code 0 alone proves no test ran/);
  const broken = check(repo(config({ suite: { name: 'whole suite', run: 'node ok.mjs', passLine: '^pass (' } })));
  assert.equal(broken.code, 1);
  assert.match(broken.out, /commands\.suite \(whole suite\): "passLine" is no regular expression/);
});

test('a project file without the tests command fails like any other missing key', () => {
  const { tests, ...commands } = config().commands;
  assert.ok(tests, 'the base config has a tests command to leave out');
  const { code, out } = check(repo({ commands }));
  assert.equal(code, 1);
  assert.match(out, /"commands\.tests" must be the command that runs named test files/);
});

test('a project file without the row command fails like any other missing key', () => {
  const { row, ...commands } = config().commands;
  assert.ok(row, 'the base config has a row command to leave out');
  const { code, out } = check(repo({ commands }));
  assert.equal(code, 1);
  assert.match(out, /"commands\.row" must be the command that runs one row of a test file; a tool with no name filter puts its one-file command there/);
});

test('a forbid folder that does not exist fails its check with one line, through the command line', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const quick = [{ name: 'no disabled row', forbid: { in: ['tests', 'specs'], extensions: ['.ts'], patterns: { 'uses .only': '\\bit\\.only\\s*\\(' } } }];
  const root = repo(config({ quick }), { 'tests/a.test.ts': "it('z', () => {});\n" });
  const run = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8', env });
  assert.equal(run.stdout, 'FAIL: no disabled row\n  specs: no such folder, so the scan proves nothing\n', run.stderr);
  assert.equal(run.status, 1);
});

test('a failing quick check stops the run with its name, exit code, last lines and a log, and the next check never runs', () => {
  const root = repo(config({ quick: [{ name: 'first', run: 'node fail.mjs' }, { name: 'second', run: 'node marker.mjs' }] }));
  const { code, out } = check(root);
  assert.equal(code, 1);
  assert.match(out, /^FAIL: first\n {2}exit 3: node fail\.mjs\n {2}line one\n {2}boom\n {2}full output: /);
  assert.doesNotMatch(out, /second/);
  assert.equal(existsSync(join(root, 'ran.txt')), false, 'the check after a failure must not run');
  const log = /full output: (.+)$/m.exec(out)[1];
  assert.equal(readFileSync(log, 'utf8'), 'line one\nboom\n');
});

test('without --suite the suite does not run and a passing quick run exits 0', () => {
  const { code, out } = check(repo(config(), { 'suite.mjs': suite('broken', 1) }));
  assert.equal(code, 0, out);
  assert.equal(out, 'PASS: quick one\nnote: the whole suite (whole suite) did not run; add --suite\n');
});

test('a suite that exits 0 without its pass line fails: no test may have run', () => {
  const { code, out } = check(repo(config(), { 'suite.mjs': suite('ℹ tests 0\nℹ pass 0\nℹ fail 0\n') }), ['--suite']);
  assert.equal(code, 1);
  assert.match(out, /PASS: quick one\nFAIL: whole suite\n {2}exit 0, but its output has no line matching the pass line/);
});

test('a suite that prints its pass line passes, and the report quotes the last one', () => {
  const printed = 'ℹ pass 2\nℹ fail 0\nℹ tests 14\nℹ pass 12\nℹ fail 0\nℹ duration_ms 9\n';
  const { code, out } = check(repo(config(), { 'suite.mjs': suite(printed) }), ['--suite']);
  assert.equal(code, 0, out);
  assert.equal(out, 'PASS: quick one\nPASS: whole suite\n  pass line: ℹ pass 12 / ℹ fail 0\n');
});

test('the pass line is found through colour codes and CRLF line ends', () => {
  const printed = 'Tests completed in 957ms\r\n\u001b[32mTests Passed: 3, \u001b[0m\u001b[90mFailed: 0, \u001b[0m\u001b[90mSkipped: 0\u001b[0m\r\n';
  // The pass line spans the line end, so a CRLF left in the output would break it as surely as a colour code.
  const commands = { suite: { name: 'pester', run: 'node suite.mjs', passLine: '^Tests completed in \\d+ms\\nTests Passed: [1-9]\\d*, Failed: 0,' } };
  const { code, out } = check(repo(config(commands), { 'suite.mjs': suite(printed) }), ['--suite']);
  assert.equal(code, 0, out);
  assert.match(out, /PASS: pester\n {2}pass line: Tests completed in 957ms \/ Tests Passed: 3, Failed: 0,\n/);
});

test('unsetEnv keeps a variable out of the command, and without it the command sees the variable', () => {
  process.env.DELIVERY_PROBE = 'set';
  try {
    const kept = check(repo(config({ quick: [{ name: 'env', run: 'node probe-env.mjs', unsetEnv: ['DELIVERY_PROBE'] }] })));
    assert.equal(kept.code, 0, kept.out);
    const seen = check(repo(config({ quick: [{ name: 'env', run: 'node probe-env.mjs' }] })));
    assert.equal(seen.code, 1, 'the control: without unsetEnv the variable reaches the command');
    assert.match(seen.out, /probe set/);
  } finally {
    delete process.env.DELIVERY_PROBE;
  }
});

test('a forbidden pattern fails with its file, label and count; skipped folders are not read; a scan of no file fails', () => {
  const forbid = (extensions) => ({
    quick: [{ name: 'no disabled row', forbid: { in: ['tests'], extensions, skip: ['node_modules'], patterns: { 'uses .only': '\\bit\\.only\\s*\\(' } } }],
  });
  const files = {
    'tests/a.test.ts': "it.only('x', () => {});\nit.only ('y', () => {});\n",
    'tests/b.test.ts': "it('z', () => {});\n",
    'tests/node_modules/c.test.ts': "it.only('vendored', () => {});\n",
  };
  const hit = check(repo(config(forbid(['.ts'])), files));
  assert.equal(hit.code, 1);
  assert.equal(hit.out, 'FAIL: no disabled row\n  tests/a.test.ts: uses .only (2)\n');
  const clean = check(repo(config(forbid(['.ts'])), { 'tests/b.test.ts': files['tests/b.test.ts'] }));
  assert.equal(clean.code, 0, clean.out);
  assert.match(clean.out, /PASS: no disabled row\n {2}scanned 1 file\(s\)/);
  const nothing = check(repo(config(forbid(['.tsx'])), files));
  assert.equal(nothing.code, 1);
  assert.match(nothing.out, /scanned no file \(\.tsx under tests\): the scan proves nothing/);
});

test('an untracked file with a listed extension fails; a staged or an ignored one does not', () => {
  const root = repo(config({ quick: [{ name: 'no untracked script', untracked: { extensions: ['.tmp'] } }] }), {
    'kept.tmp': 'x',
    'staged.tmp': 'x',
    'ignored/skip.tmp': 'x',
    '.gitignore': 'ignored/\n',
  });
  const git = (...args) => assert.equal(spawnSync('git', args, { cwd: root, encoding: 'utf8' }).status, 0, `git ${args.join(' ')}`);
  git('init', '-q');
  git('add', 'staged.tmp');
  const { code, out } = check(root);
  assert.equal(code, 1);
  assert.equal(out, 'FAIL: no untracked script\n  kept.tmp: git does not track it, so it is a scratch file; keep it outside the clone or commit it\n');
});

test('a command that runs past its timeout fails as timed out', () => {
  const { code, out } = check(repo(config({ quick: [{ name: 'slow', run: 'node sleep.mjs', timeoutMinutes: 0.02 }] })));
  assert.equal(code, 1);
  assert.match(out, /FAIL: slow\n {2}timed out after 0\.02 minute\(s\): node sleep\.mjs/);
});

test('the filled example in project-file-template.md is a project file this script accepts', () => {
  const template = readFileSync(join(import.meta.dirname, 'project-file-template.md'), 'utf8').replace(/\r\n/g, '\n');
  const example = /^````markdown\n([\s\S]*?)^````$/m.exec(template)?.[1];
  assert.ok(example, 'the template has a ````markdown example');
  const { config, error } = parseProject(example);
  assert.equal(error, undefined);
  assert.deepEqual(validate(config), []);
  assert.equal(config.commands.quick.length, 3);
});

test('the command line exits 0 with PASS lines in a ready repository, and 1 without a project file', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const ready = spawnSync(process.execPath, [SCRIPT], { cwd: repo(config()), encoding: 'utf8', env });
  assert.equal(ready.status, 0, ready.stdout + ready.stderr);
  assert.match(ready.stdout, /^PASS: quick one\n/);
  const bare = spawnSync(process.execPath, [SCRIPT, '--suite'], { cwd: repo(null), encoding: 'utf8', env });
  assert.equal(bare.status, 1);
  assert.match(bare.stdout, /^FAIL: no project file: /);
});
