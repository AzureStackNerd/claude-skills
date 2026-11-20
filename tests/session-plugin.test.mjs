// Guards that /session:handoff runs on any Claude Code installation: it calls the checker bundled with the plugin,
// by ${CLAUDE_PLUGIN_ROOT}, and never a script on one user's disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN = join(import.meta.dirname, '..', 'plugins', 'session');
const BUNDLED = '${CLAUDE_PLUGIN_ROOT}/scripts/Test-Handoff.ps1';

/** Each problem with how `text` (a command's Markdown) calls the handoff checker. */
export function checkerGaps(text) {
  const gaps = [];
  const runs = text.split(/\r?\n/).filter((line) => /pwsh\b.*Test-Handoff\.ps1/.test(line));
  if (runs.length === 0) gaps.push('no pwsh line runs Test-Handoff.ps1');
  for (const line of runs) if (!line.includes(`"${BUNDLED}"`)) gaps.push(`not the bundled checker: ${line.trim()}`);
  for (const line of text.split(/\r?\n/)) {
    if (/OneDrive|\$USERPROFILE|C:[\\/]Users/i.test(line)) gaps.push(`a personal path: ${line.trim()}`);
  }
  return gaps;
}

test('checkerGaps catches a personal path and a missing run, and passes the bundled call', () => {
  const good = `- **Run** \`pwsh -NoProfile -File "${BUNDLED}" -Path "$TEMP/x-na.md"\``;
  assert.deepEqual(checkerGaps(good), []);
  const old = '- **Run** `pwsh -NoProfile -File "$USERPROFILE/OneDrive - Gridly/Documents/Claude/scripts/Test-Handoff.ps1"`';
  assert.equal(checkerGaps(old).length, 2, 'not bundled, and a personal path');
  assert.deepEqual(checkerGaps('no checker here'), ['no pwsh line runs Test-Handoff.ps1']);
});

test('/session:handoff runs the checker bundled with the plugin', () => {
  assert.deepEqual(checkerGaps(readFileSync(join(PLUGIN, 'commands', 'handoff.md'), 'utf8')), []);
});

test('the plugin ships the checker and its Pester tests', () => {
  for (const file of ['Test-Handoff.ps1', 'Test-Handoff.Tests.ps1']) {
    assert.ok(existsSync(join(PLUGIN, 'scripts', file)), `plugins/session/scripts/${file} is missing`);
  }
});
