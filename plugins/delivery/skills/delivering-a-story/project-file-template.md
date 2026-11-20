# The project file: `.claude/delivery.md`

Every repository that delivers stories with this skill commits one `.claude/delivery.md`. It holds what the skill
leaves to the repository: the product's end state, the backlog, the commands, the paths, the brief rules and the done
rule. The product owner reads it whole at the start of every story; `check-gate.mjs` reads only its JSON block. When a
repository has none, the skill stops at the start and offers to write one from this file.

It is Markdown, so a human reads it in review, with exactly one fenced `json` block for what a script reads.

## What it holds

1. **End state** (a `## End state` section): one or two sentences on the product's end state. Every brief opens with
   them, and every story is weighed against them.
2. **Backlog** (a `## Backlog` section):
   - the adapter, `azure-devops` or `github` (the file of that name in `backlogs/` of this skill);
   - its target: for Azure DevOps the organisation, the project, the area path and the tag that select this
     product's items, and the MCP server that reaches that organisation; for GitHub the `owner/repo`, the labels, and
     the project that holds a status or estimate field, if one does;
   - the hierarchy, from the top level down (for example Epic, Feature, then the story level);
   - the state names, when they differ from what the adapter would read from the process;
   - who may write to it: the stakeholder's own backlog takes the product owner's writes; a customer's backlog is
     read-only, and every write waits for the stakeholder's yes on that write.
3. **The JSON block** (a `## Commands, paths and rules` section), with these fields:

| Field | Required | What it is |
| --- | --- | --- |
| `commands.quick` | yes | The checks run after every build area, in order, stopping at the first failure. At least one. |
| `commands.tests` | yes | The command that runs named test files; `{files}` stands for them, written as that command takes them. |
| `commands.row` | yes | The command that runs one row of one file, for a mutation's re-run; `{files}` and `{row}`. A tool with no name filter puts its one-file command here, with `{files}` only: the re-run is then the whole file, and the row's own result line in its output still shows the row ran. |
| `commands.suite` | yes | The whole suite, a `run` check with its `passLine`. Run by the Scrum Master with `--suite`. |
| `paths.source` | yes | The folders the Developer writes, besides the docs. |
| `paths.tests` | yes | The folders the TestWriter writes; the proving tests of a refinement live here. |
| `paths.docs` | no | The docs that describe the product, for the site list's doc column. |
| `paths.refinements` | yes | Where refinements go; each one's gate files go beside it. |
| `paths.scratch` | yes | A folder outside the clone for a story's scratch copies; `{story}` stands for the story's id. |
| `provingTest` | no | A regular expression the file path of every refinement's "Proving test" must match. Without it, a file named `*.test.js`, `*.test.ts` and the like counts. |
| `stakeholder` | no | The stakeholder's name, as they sign a point that changes an AC: `(<name>, <date>)`. A letter first, then letters, spaces, `.`, `'` or `-`. The word `stakeholder` is always accepted as well. |
| `briefRules` | no | Lines every brief in this repository carries (line endings, file rules, tool quirks). |
| `done` | no | What makes a story delivered here; the skill closes the panes only once it holds. |

A check in `commands.quick`, and `commands.suite`, has a `name` and exactly one kind:

| Kind | Fields | Passes when |
| --- | --- | --- |
| `run` | `run`: a shell command (`cmd.exe` on Windows, `sh` elsewhere), run in the repository root; optional `passLine`, `unsetEnv`, `timeoutMinutes` (default 10) | the command exits 0 and, with a `passLine`, that regular expression matches its output; the match is multi-line, after colour codes are removed and line ends made `\n` |
| `forbid` | `in`: folders; `extensions`; `patterns`: label to regular expression; optional `skip`: folder names (default `node_modules`, `.git`) | no scanned file holds a pattern, and the scan read at least one file |
| `untracked` | `extensions` | git lists no untracked, not-ignored file with one of them |

`unsetEnv` names environment variables the command must not inherit: a test runner that finds itself inside another
runner's variables, or given a skip pattern through them, can run nothing and still exit 0. The pass line is there for
the same reason: an exit code 0 alone has proved nothing before.

`provingTest` is read by `check-refinement.mjs` from the project file in its working folder, so the Scrum Master runs
it from the repository root. The file path is the "Proving test" cell's text before its quoted row, without backticks;
the pattern is searched in it, so anchor it with `$` or `(^|/)`. Two examples:

| Test framework | File names | `provingTest` |
| --- | --- | --- |
| Pester | `tests/Report.Tests.ps1` | `"\\.Tests\\.ps1$"` |
| pytest | `tests/test_report.py` | `"(^\|/)test_[^/]*\\.py$"` |

A `provingTest` that is no regular expression, or a project file whose JSON block cannot be read, fails gate 1 with
one line naming the project file.

A JSON string doubles every backslash, so the regular expression `\d` is written `"\\d"` and a line end `"\\n"`.

## A filled example

A PowerShell module whose backlog is in GitHub Issues. Its commands were measured with Pester 6.2.0 on 2026-11-15:
`Invoke-Pester -CI` exits 1 when a test fails, and its summary line reads `Tests Passed: 1, Failed: 0, Skipped: 0,
Inconclusive: 0, NotRun: 0` (in colour, even into a pipe).

````markdown
# Delivery: Contoso.Tagging

## End state

Contoso.Tagging keeps every Azure resource's tags right without a person checking: a missing or wrong tag is
reported, or fixed, on the day it appears.

## Backlog

- Adapter: `github`.
- Target: `contoso/tagging`; stories carry the label `story`, bugs the label `bug`. The GitHub project number 3 of
  owner `contoso` holds the fields Status and Estimate.
- Hierarchy: an issue labelled `epic` holds its stories as sub-issues; a story has no children.
- Who may write: the product owner comments, labels and sets the project Status; closing an issue waits for the
  done rule.

## Commands, paths and rules

```json
{
  "commands": {
    "quick": [
      { "name": "fast tests", "run": "pwsh -NoProfile -Command \"Invoke-Pester -Path ./tests -TagFilter Fast -CI\"" },
      {
        "name": "no skipped test",
        "forbid": { "in": ["tests"], "extensions": [".ps1"], "patterns": { "uses -Skip": "\\b(?:It|Describe)\\b[^\\n]*\\s-Skip\\b" } }
      },
      { "name": "no untracked script", "untracked": { "extensions": [".ps1"] } }
    ],
    "tests": "pwsh -NoProfile -Command \"Invoke-Pester -Path {files} -CI\"",
    "row": "pwsh -NoProfile -Command \"Invoke-Pester -Path {files} -FullNameFilter '*{row}*' -CI\"",
    "suite": {
      "name": "all Pester tests",
      "run": "pwsh -NoProfile -Command \"Invoke-Pester -Path ./tests -CI\"",
      "passLine": "^Tests Passed: [1-9]\\d*, Failed: 0,",
      "timeoutMinutes": 20
    }
  },
  "paths": {
    "source": ["Contoso.Tagging/"],
    "tests": ["tests/"],
    "docs": ["README.md", "docs/"],
    "refinements": "docs/refinements/",
    "scratch": "../scratch/tagging-{story}"
  },
  "provingTest": "\\.Tests\\.ps1$",
  "briefRules": [
    "Scripts are PowerShell 7: run them with pwsh, never Windows PowerShell 5.1.",
    "Invoke-Pester -CI writes testResults.xml in the working folder: delete it, never commit it."
  ],
  "done": "Its pull request is merged into main and its issue is closed as completed, with a comment naming the merge commit."
}
```
````

The `-Skip` pattern and the folder names in the example are this example's own, not checked against a real module.
