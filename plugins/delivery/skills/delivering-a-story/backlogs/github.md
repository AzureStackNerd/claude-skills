# Backlog adapter: GitHub Issues

For a repository whose `.claude/delivery.md` names the adapter `github`. It maps the skill's words to GitHub Issues
and Projects and says how to read and write an item with the `gh` CLI. The project file gives the target: the
`owner/repo`, the labels that mark a story and a bug, the project (number and owner) that holds a status or estimate
field, the hierarchy, and who may write.

Sources, read on 2026-11-15: the `--help` of `gh` 2.102.0 (`gh issue view`, `edit`, `create`, `close`, `comment`,
`list`; `gh project`, `item-edit`, `item-list`, `field-list`, `item-add`). A line marked *unchecked* rests on neither.

## The skill's words in GitHub

| The skill says | In GitHub |
| --- | --- |
| backlog item | an issue, with the project file's label for a story or a bug |
| its children | its sub-issues; an issue has at most one parent |
| started | GitHub issues have no started state: the project's Status field set to the project file's started value (for example "In Progress"), or a label the project file names |
| done | the issue closed with the reason `completed`, once the project file's done rule holds |
| estimate | no native field: a number field of the project (for example "Estimate"), or a label the project file names |
| a comment | an issue comment |

## Commands

Every command takes `--repo <owner>/<repo>` when it runs outside that repository's clone.

| Need | Command |
| --- | --- |
| Read an item | `gh issue view <n> --json number,title,body,state,stateReason,labels,comments,parent,subIssues,projectItems` |
| List the open stories | `gh issue list --label <story label> --state open --json number,title,labels` |
| File a story under its parent | `gh issue create --title "<title>" --body-file <file> --label <story label> --parent <parent n>` |
| Make an issue a child | `gh issue edit <child n> --parent <parent n>`, or `gh issue edit <parent n> --add-sub-issue <child n>` |
| Change labels or the body | `gh issue edit <n> --add-label <x> --remove-label <y>`; `gh issue edit <n> --body-file <file>` |
| Comment | `gh issue comment <n> --body-file <file>` |
| Close as done | `gh issue close <n> --reason completed --comment "<done comment>"` |
| Set the project's Status | `gh project item-edit <project number> --owner <owner> --url <issue url> --field Status --value "<option name>"` |
| Read the project's fields | `gh project field-list <project number> --owner <owner>` |
| Add an issue to the project | `gh project item-add <project number> --owner <owner> --url <issue url>` |

Write a body or comment that holds backticks or `$` to a file and pass it with `--body-file`; on the command line the
shell expands them.

`gh project` needs the token's `project` scope: `gh auth status` shows the scopes, and `gh auth refresh -s project`
adds it. `gh project item-edit` updates one field per call for an issue. Setting a number field by name, as
`--field Estimate --number <n>`, is *unchecked*: its help shows selection by name with `--value` and the `--number`
flag, but no example of the two together.

## Who may write

The project file says. The stakeholder's own repository takes the product owner's writes: the user story in the
issue body, the estimate, its Status changes, the done comment and the close. A customer's repository is read-only:
every write (create, edit, label, comment, close, project field) is shown to the stakeholder first and goes out only
on their yes for that write.
