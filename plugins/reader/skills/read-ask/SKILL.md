---
name: read-ask
description: Use when you need to find something in files without editing them — where a function is defined or called, which tests import a module, what a document says about a topic — and the answer matters more than the file's full text. Hands the reading to a cheaper read-only model through the read-ask command, so only its short answer enters your context.
---

# read-ask: reconnaissance reads on a cheaper model

Every file you read stays in your context and is sent again on every later turn. For a question about the code or the
docs that you only need the answer to, let `read-ask` do the reading: it runs Claude headless on a cheaper model that
can only read, and is told to answer in at most 20 lines, each finding as `path:line` with the line quoted (an
instruction to the model; nothing cuts the output off).

```shell
read-ask "Where is parseConfig defined, and which files call it?"
read-ask "Which test files import src/policy.ts? Search under test/."
read-ask "What does docs/design.md say about retries? Quote the lines."
```

Run it from the repository root: the reader searches from its working folder.

## When to use it, and when not

- **Use it** to locate and summarise: definitions, callers, importers, config values, what a section of a document
  says, whether a phrase occurs anywhere.
- **Read the file yourself** when you will edit it (Edit only works on a file your own session has read), when you
  must quote it exactly in your own work, or when the reader's answer is the basis of a decision that cannot be undone.
- **Check its answer** where it matters: open the `path:line` it quotes. A "not found" is only as good as the searches
  it names; if they missed the obvious place, search there yourself.

## Configuration

Without configuration `read-ask` uses Haiku on your normal login. It never loads your own settings files (user,
project or local), so none of your hooks, plugins, output styles or permission rules reach the reader.

| Setting | Flag | Environment variable | Effect |
| --- | --- | --- | --- |
| Settings file | `--settings <file>` | `READER_SETTINGS` | Runs the reader with that Claude Code settings file, the only settings it loads. Use it for another gateway or provider; set the model in that file too, or pass `--model`, or the CLI's default model runs. |
| Model | `--model <model>` | `READER_MODEL` | The model; default Haiku without a settings file. |
| Turns | | `READER_MAX_TURNS` | Caps the reader's turns, 15 by default. |

A flag wins over its environment variable. Set your own values where your Claude Code setup keeps personal
configuration, for example the `env` block of your user settings, or a memory that tells the agent which flags to pass.

## What it can and cannot do

- Its tools are Read, Grep and Glob, and nothing else: no shell, no Edit, no Write, no MCP tools.
- It runs in `dontAsk` mode, so it never asks for permission, and it runs once and keeps no session.
- A question that starts with `-` goes after `--` (`read-ask -- "-v flag: where is it parsed?"`); the script always
  passes the question to Claude after `--`, so it can never be read as one of Claude's flags.

**Prerequisites:** the `claude` command on PATH, and bash (Git Bash on Windows).
