# Backlog adapter: Azure DevOps

For a repository whose `.claude/delivery.md` names the adapter `azure-devops`. It maps the skill's words to Azure
Boards and says how to read and write an item. The project file gives the target: the organisation, the project, the
area path and tag that select this product's items, the MCP server that reaches the organisation, the hierarchy, and
who may write.

Sources, read on 2026-11-15: Microsoft Learn ([default processes][processes], [workflow states and state
categories][categories], [estimate fields][numeric], [link types][links], [WIQL][wiql]) and the tool schemas of the
Azure DevOps MCP server the skill was written against. A line marked *unchecked* rests on neither.

## The skill's words in Azure DevOps

| The skill says | In Azure DevOps |
| --- | --- |
| backlog item | a work item of the project's story level: User Story (Agile process), Product Backlog Item (Scrum), Requirement (CMMI), Issue (Basic); or a Bug |
| its children | the items it links to with the Child link, reference name `System.LinkTypes.Hierarchy-Forward`; an item has at most one Parent |
| started | the item's first state in the **In Progress** state category |
| done | the item's state in the **Completed** state category; each type has exactly one |
| estimate | Story Points (Agile, `Microsoft.VSTS.Scheduling.StoryPoints`), Effort (Scrum, `Microsoft.VSTS.Scheduling.Effort`), Size (CMMI, `Microsoft.VSTS.Scheduling.Size`); Basic has none by default |
| a comment | a discussion comment on the work item |

## States per default process

| Process | Story-level type | Proposed | In Progress (started) | Resolved | Completed (done) | Removed |
| --- | --- | --- | --- | --- | --- | --- |
| Agile | User Story | New | Active | Resolved (Bug only) | Closed | Removed |
| Scrum | Product Backlog Item | New, Approved | Committed | none | Done | Removed |
| CMMI | Requirement | Proposed | Active; Resolved for Requirement | Resolved (Bug and others) | Closed | none by default |
| Basic | Issue | To Do | Doing | none | Done | none |

An inherited process can rename, add or hide states. Then read the type's states (below) and take the started and
done states from the project file, which names them when they differ from this table. The tool lists a type's state
names, not their categories.

## Tools

The MCP server the project file names, one per organisation. Its tools are named
`mcp__<server>__<tool>`; the ones this skill needs:

| Need | Tool | Notes from its schema |
| --- | --- | --- |
| Read an item with its fields, comments and links | `get_work_item` (`id`, `project`) | the links come with it; follow the Child ones for the children |
| Find items | `search_work_items` (`query`, `project`, `top`) | WIQL, at most 200 results |
| Read the types and their states | `get_work_item_types` (`project`) | state names per type |
| Comment | `add_work_item_comment` (`id`, `text`) | HTML allowed; an `@`-mention notifies that person |
| Change the state, estimate, description, tags | `update_work_item` (`id`, `state`, `effort`, `description`, `acceptanceCriteria`, `tags`) | only the fields given change; `tags` replaces every tag, so read them first and send the whole list |
| File a story under its parent | `create_work_item` (`type`, `title`, `parentId`, `description`, `tags`, `areaPath`) | `parentId` makes it a child |
| Link two items | `link_work_items` (`sourceId`, `targetId`, `linkType`) | `parent`: the source becomes the target's child |

The `effort` field of `update_work_item` is described as "Effort / story points"; which reference field it writes in
a CMMI project is *unchecked*.

Children by query: a WIQL query `FROM WorkItemLinks` with `[System.Links.LinkType] =
'System.LinkTypes.Hierarchy-Forward'` and `[Source].[System.Id] = <id>` returns the links to them. Whether
`search_work_items` accepts a `WorkItemLinks` query is *unchecked*; reading the item and following its Child links
needs no query.

## Who may write

The project file says. The stakeholder's own backlog takes the product owner's writes: the user story in the
description, the estimate, its state changes, the done comment. A customer's backlog is read-only: every write
(create, update, link, state, comment) is shown to the stakeholder first and goes out only on their yes for that
write, also when it only records a decision they just made.

[processes]: https://learn.microsoft.com/azure/devops/boards/work-items/guidance/choose-process
[categories]: https://learn.microsoft.com/azure/devops/boards/work-items/workflow-and-state-categories
[numeric]: https://learn.microsoft.com/azure/devops/boards/queries/query-numeric
[links]: https://learn.microsoft.com/azure/devops/boards/queries/link-type-reference
[wiql]: https://learn.microsoft.com/azure/devops/boards/queries/wiql-syntax
