// Guards read-ask: it can only read, it loads none of the user's settings files, a question can never become a claude
// flag, it takes the user's own settings file or model, and it falls back to haiku. A fake `claude` on PATH prints the
// arguments it was given, one per line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const READ_ASK = join(import.meta.dirname, '..', 'plugins', 'reader', 'bin', 'read-ask');
const FAKE = mkdtempSync(join(tmpdir(), 'read-ask-fake-'));
writeFileSync(join(FAKE, 'claude'), '#!/usr/bin/env bash\nfor a in "$@"; do printf "%s\\n" "$a"; done\n');
chmodSync(join(FAKE, 'claude'), 0o755);
const SETTINGS = join(FAKE, 'gateway.json');
writeFileSync(SETTINGS, '{}');

/** read-ask's run with `args` and `env`, the fake claude first on PATH; `argv` is what claude received. */
function run(args, env = {}) {
  const clean = { ...process.env, READER_SETTINGS: '', READER_MODEL: '', READER_MAX_TURNS: '' };
  const result = spawnSync('bash', [READ_ASK, ...args], {
    encoding: 'utf8',
    env: { ...clean, ...env, PATH: `${FAKE}${delimiter}${process.env.PATH}` },
  });
  return { status: result.status, stderr: result.stderr, argv: result.stdout.split('\n').slice(0, -1) };
}

/** The value after `flag` in `argv`, or undefined. */
const valueOf = (argv, flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
/** claude's own options: everything before the "--" that ends them. */
const optionsOf = (argv) => argv.slice(0, argv.lastIndexOf('--'));

test('in both modes the reader gets only Read, Grep and Glob, loads none of the user settings and asks nobody', () => {
  for (const { argv } of [run(['where is main?']), run(['--settings', SETTINGS, 'where is main?'])]) {
    assert.equal(valueOf(argv, '--setting-sources'), '', 'no user, project or local settings: no hook or allow rule');
    assert.equal(valueOf(argv, '--tools'), 'Read,Grep,Glob');
    assert.equal(valueOf(argv, '--allowedTools'), 'Read,Grep,Glob');
    assert.equal(valueOf(argv, '--disallowedTools'), 'mcp__*');
    assert.equal(valueOf(argv, '--permission-mode'), 'dontAsk');
    assert.ok(argv.includes('--strict-mcp-config') && argv.includes('-p') && argv.includes('--no-session-persistence'));
    assert.ok(!argv.includes('--bare'), 'bare mode has no Grep or Glob and skips the login');
    assert.deepEqual(argv.slice(-2), ['--', 'where is main?']);
  }
});

test('a question that starts with a dash, after --, reaches claude as the question and never as a flag', () => {
  const { status, argv } = run(['--', '--dangerously-skip-permissions']);
  assert.equal(status, 0);
  assert.deepEqual(argv.slice(-2), ['--', '--dangerously-skip-permissions']);
  assert.ok(!optionsOf(argv).includes('--dangerously-skip-permissions'));
});

test('without a settings file: haiku; with one, by flag or READER_SETTINGS: that file and no forced model', () => {
  const plain = run(['what calls parse?']).argv;
  assert.equal(valueOf(plain, '--model'), 'haiku');
  assert.equal(valueOf(optionsOf(plain), '--settings'), undefined);
  for (const { argv } of [run(['--settings', SETTINGS, 'q']), run(['q'], { READER_SETTINGS: SETTINGS })]) {
    assert.equal(valueOf(argv, '--settings'), SETTINGS);
    assert.equal(valueOf(argv, '--model'), undefined);
  }
});

test('the model comes from --model, else READER_MODEL; the flag wins', () => {
  assert.equal(valueOf(run(['--model', 'sonnet', 'q']).argv, '--model'), 'sonnet');
  assert.equal(valueOf(run(['q'], { READER_MODEL: 'opus' }).argv, '--model'), 'opus');
  assert.equal(valueOf(run(['--model', 'sonnet', 'q'], { READER_MODEL: 'opus' }).argv, '--model'), 'sonnet');
  assert.equal(valueOf(run(['--settings', SETTINGS, '--model', 'x-groot', 'q']).argv, '--model'), 'x-groot');
});

test('READER_MAX_TURNS caps the turns, 15 by default', () => {
  assert.equal(valueOf(run(['q']).argv, '--max-turns'), '15');
  assert.equal(valueOf(run(['q'], { READER_MAX_TURNS: '4' }).argv, '--max-turns'), '4');
});

test('no question, an unknown option or a missing settings file stops with exit 2 and runs no reader', () => {
  for (const args of [[], ['   '], ['--verbose', 'q'], ['--settings', join(FAKE, 'missing.json'), 'q'], ['--model'], ['--']]) {
    const result = run(args);
    assert.equal(result.status, 2, `${JSON.stringify(args)}: ${result.stderr}`);
    assert.deepEqual(result.argv, [], `${JSON.stringify(args)} ran the reader`);
  }
});
