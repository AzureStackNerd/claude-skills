---
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, mcp__neocortex__search_memories, mcp__neocortex__get_memory, mcp__neocortex__save_memory, mcp__neocortex__update_memory, mcp__neocortex__list_labels, mcp__plugin_neocortex_neocortex__search_memories, mcp__plugin_neocortex_neocortex__get_memory, mcp__plugin_neocortex_neocortex__save_memory, mcp__plugin_neocortex_neocortex__update_memory, mcp__plugin_neocortex_neocortex__list_labels
description: End session — persist durable learnings to memory (session state goes via /session:handoff)
---

## Context

- Current project directory: $ARGUMENTS
- Today's date: !`date +%Y-%m-%d`
- Git changes this session: !`git diff --stat HEAD~5 2>/dev/null || echo "not a git repo or no recent commits"`
- Current branch: !`git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git branch --show-current || echo "not a git repo"`

## Where memory lives (NeoCortex)

- Memory is NeoCortex, reached only through its MCP tools: `search_memories`, `get_memory`, `save_memory`,
  `update_memory`, `list_labels`. Without a NeoCortex MCP server this command cannot save anything: say so and stop.
  Do not write memory files by hand, and do not edit NeoCortex's own files from here.
- Scope `user` applies everywhere; scope `project` only in the current repository. A fact about one repository goes
  in project scope from a session in that repository.
- Session state (progress, start point for the next session) belongs in the handoff memory
  (`Handoff: <name>`, label `handoff`), written only by `/session:handoff`. Open items go to the project's backlog system
  when Claude may write there, else into the handoff (see `/session:handoff` step 2). Do not put open items in any other memory.

## Your task

Review the entire conversation history from this session and persist the durable learnings to memory files. Use `/session:handoff` for the
session state itself; this command only covers what should change behaviour in later sessions.

### Steps

1. **Review the conversation** — go through everything discussed, decided, discovered, built, or debugged. Identify:
   - New patterns, conventions, or architectural decisions
   - User preferences or workflow corrections
   - Important file paths or project structure changes
   - Solutions to problems encountered
   - New tools, commands, or integrations discovered
   - Design decisions and their rationale
   - Corrections to previously held assumptions

2. **Read existing memory** — `search_memories` for each subject above, and `get_memory` for the matches, so nothing
   is duplicated. Also look for memories that duplicate each other, and merge them.

3. **Determine what's new** — only persist genuinely new or updated information. Understand the two destinations:

   **Project `CLAUDE.md`** (in project root, only after the user agrees) — instructions and rules that guide behaviour:
   - Code style conventions, linting rules, formatting preferences
   - Build/deploy commands and workflows
   - Architectural decisions that affect how code should be written
   - Project-specific constraints (e.g. "no hardcoded hex colors", "use existing build scripts")
   - Always loaded as system context — keep it prescriptive and concise

   **NeoCortex memories** — knowledge and context for continuity across sessions:
   - Learned lessons, gotchas, and troubleshooting solutions
   - Important file paths, credentials references, and project structure
   - Content approach and domain knowledge
   - Permission settings and tool configuration notes
   - **Corrections**: if something in memory is now wrong or outdated, update it; delete only with the user's agreement

4. **Write updates** — `update_memory` for an existing memory, `save_memory` for a new one. One rule per memory; the
   `summary` is the rule itself in one sentence of at most 300 characters (it is what loads at every start); `why` is
   required; labels are one of `feedback`, `user`, `context`, `reference` plus topic labels from `list_labels`. When
   the body changes, check that the summary still states the rule.

5. **Report back** — summarise:
   - What new learnings were persisted (short id and title of each memory)
   - What existing memories were updated or corrected
   - If nothing new was learned, say so — don't write memory for the sake of it

### Important

- Be selective — only persist stable, verified knowledge, not speculative or in-progress thoughts
- Keep summaries short and true to the body; the detail goes in the body
- Do NOT save a new memory when an existing one covers the subject; update that one
- Prefer updating existing entries over adding new ones when the topic already exists
- Do not save what the repo already records (code structure, git history, CLAUDE.md) or what only matters to this conversation
