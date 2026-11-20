<#
.SYNOPSIS
    Mechanical check of a lean handoff memory. Fails loud; green only when every check passes.

.DESCRIPTION
    Called by /session:handoff (the session plugin, commands/handoff.md) after it wrote the handoff memory.
    Checks the structure of the lean handoff, nothing about the truth of its content:
      - "## Backlog" is optional: a project whose open work lives in its own backlog tool writes none; when the
        section is there, it holds at least one numbered item
      - exactly one dated block "## yyyy-MM-dd" (the latest session's log), dated today unless -Migration
      - "## Eigen fouten" exists and is not empty
      - with -Previous and no "## Backlog" in the new version: fails when the previous version had numbered backlog
        items, unless -BacklogMoved says they moved to the project's backlog system (on the user's yes)
      - with -Previous and a "## Backlog" in the new version: every numbered backlog item of the previous version is in the new backlog or under
        "### Afgerond" in the dated block, recognised by its first five words after number and priority marker
        ((Hoog), [hoog], **Hoog** —, **P1 —); each new item accounts for one old item at most, and a previous
        version without numbered backlog items fails, because then nothing was compared
    YAML frontmatter at the top (a memory file, a draft) and fenced code blocks are ignored. Exit code 0 = PASS, 1 = FAIL (every failed
    check is listed).

.PARAMETER Path
    The new version: a file with the handoff's body as get_memory returns it, or a draft.

.PARAMETER Previous
    The previous version: a file with the body from before the update, or an old handoff file. Omit for a new
    handoff.

.PARAMETER BacklogMoved
    The previous version's backlog moved to the project's backlog system on the user's yes; the new version may then
    have no "## Backlog". Pass it only for that handoff.

.PARAMETER Migration
    Allow an older date on the dated block: a converted handoff keeps the log of the last session that worked on it.

.EXAMPLE
    pwsh -NoProfile -File Test-Handoff.ps1 -Path "$env:TEMP\handoff-1a2b3c4d-na.md" -Previous "$env:TEMP\handoff-1a2b3c4d-voor.md"
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory)]
    [string]$Path,

    [ValidateNotNullOrEmpty()]
    [string]$Previous,

    [switch]$Migration,

    # The backlog of the previous version moved to the project's backlog system, on the user's yes: the new version
    # may then have no "## Backlog" although the previous one had numbered items.
    [switch]$BacklogMoved
)

# Called from Git Bash, pwsh would write stdout in the console code page and mangle the literal item lines.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Get-Section {
    # The "## " sections of a text in order; a section runs to the next "## " heading or the end.
    param ([string]$Text)
    foreach ($match in [regex]::Matches($Text, '(?ms)^## (?<title>[^\r\n]+)\r?\n(?<body>.*?)(?=^## |\z)')) {
        [pscustomobject]@{ Title = $match.Groups['title'].Value.Trim(); Body = $match.Groups['body'].Value }
    }
}

function Read-Text {
    # A whole file as one string without fenced code blocks, whose "## " lines are no headings; '' for an empty file.
    param ([string]$File)
    $read = @{
        LiteralPath = $File
        Raw         = $true
        Encoding    = 'utf8'
    }
    # A fence is ``` or ~~~ (or longer), indented up to three spaces, closed by the same characters at least as long.
    [string](Get-Content @read) -replace '(?ms)^ {0,3}(?<fence>(?<c>[`~])\k<c>{2,})[^\r\n]*\r?\n.*?^ {0,3}\k<fence>\k<c>*[ \t]*(?:\r?\n|\z)', ''
}

function Get-ListItem {
    # Top-level list items (no indent): numbered ones, or also dashes and stars with -AnyMarker. Words is the item's
    # text after number and priority, without emphasis and punctuation, in lower case; Key is its first five words.
    param ([string]$Text, [switch]$AnyMarker)
    $pattern = if ($AnyMarker) { '(?m)^(\d+[.)]|[-*])\s+\S.*$' } else { '(?m)^\d+[.)]\s+\S.*$' }
    # A priority marker: (Hoog), [hoog], **Hoog** —, **P1 —, with or without bold and a dash after it.
    $marker = '(?i)^\**\s*(\[[^\]]*\]|\([^)]*\)|(p\d|hoog|middel|midden|laag)\b)\s*\**\s*[—–-]?\s*'
    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $line = $match.Value.TrimEnd()
        $text = ($line -replace '^(\d+[.)]|[-*])\s+', '') -replace $marker, ''
        $words = @(($text -replace '[*`]', '') -split '\s+' | ForEach-Object { $_.Trim('.,:;!?()').ToLowerInvariant() } | Where-Object { $_ })
        [pscustomobject]@{ Key = (@($words | Select-Object -First 5) -join ' '); Words = ($words -join ' '); Line = $line }
    }
}

$failures = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Output "FAIL: handoff not found: $Path"
    exit 1
}

$sections = @(Get-Section -Text (Read-Text -File $Path))
$today = Get-Date -Format 'yyyy-MM-dd'

# A project whose open work lives in its own backlog tool writes no "## Backlog" section; one that has the section
# must keep a numbered item in it.
$backlog = $sections | Where-Object Title -Match '^Backlog\b' | Select-Object -First 1
$newItems = @()
if ($null -ne $backlog) {
    $newItems = @(Get-ListItem -Text $backlog.Body)
    if ($newItems.Count -eq 0) { $failures.Add('Backlog has no numbered item') }
}

$dated = @($sections | Where-Object { $_.Title -match '^\d{4}-\d{2}-\d{2}\b' })
$doneItems = @()
if ($dated.Count -ne 1) {
    $failures.Add("expected exactly one dated block '## yyyy-MM-dd' (the latest session), found $($dated.Count)")
}
else {
    if (-not $Migration -and $dated[0].Title.Substring(0, 10) -ne $today) {
        $failures.Add("the dated block is '## $($dated[0].Title)', not today ($today)")
    }
    $afgerond = [regex]::Match($dated[0].Body, '(?ms)^### Afgerond[^\r\n]*\r?\n(?<list>.*?)(?=^### |\z)')
    if ($afgerond.Success) { $doneItems = @(Get-ListItem -Text $afgerond.Groups['list'].Value -AnyMarker) }
}

$mistakes = $sections | Where-Object Title -EQ 'Eigen fouten' | Select-Object -First 1
if ($null -eq $mistakes) {
    $failures.Add('no "## Eigen fouten" section')
}
elseif (-not $mistakes.Body.Trim()) {
    $failures.Add('"## Eigen fouten" is empty (write "geen waargenomen" if there were none)')
}

if ($Previous) {
    if (-not (Test-Path -LiteralPath $Previous -PathType Leaf)) {
        $failures.Add("previous version not found: $Previous")
    }
    else {
        $oldSections = Get-Section -Text (Read-Text -File $Previous) | Where-Object Title -Match '^Backlog\b'
        $oldItems = @($oldSections | ForEach-Object { Get-ListItem -Text $_.Body })
        if ($null -eq $backlog) {
            # Without a backlog in the new version nothing is compared, but a backlog that had items may only go when the
            # caller says it moved to the project's backlog system.
            if ($oldItems.Count -gt 0 -and -not $BacklogMoved) {
                $failures.Add("previous version has $($oldItems.Count) backlog items and this one has no `"## Backlog`"; pass -BacklogMoved only once they are in the project's backlog system")
            }
        }
        elseif ($oldItems.Count -eq 0) {
            $failures.Add("previous version has no numbered backlog item to compare with: $Previous")
        }
        else {
            # Each new or Afgerond item accounts for one old item at most; the most specific old item claims first.
            $pool = [System.Collections.Generic.List[string]]::new([string[]]@($newItems + $doneItems | ForEach-Object Words))
            # An unchanged item claims its own line first, so when two items share their first words, the one named is
            # the one that is gone, not the one that is still there.
            $open = [System.Collections.Generic.List[object]]::new()
            foreach ($item in $oldItems) {
                $exact = $pool.IndexOf($item.Words)
                if ($exact -lt 0) { $open.Add($item) } else { $pool.RemoveAt($exact) }
            }
            $dropped = [System.Collections.Generic.HashSet[object]]::new()
            foreach ($item in $open | Sort-Object -Property { ($_.Key -split ' ').Count } -Descending) {
                $key = $item.Key
                $hit = $pool.FindIndex({ param($words) $words -eq $key -or $words.StartsWith("$key ") })
                if ($hit -lt 0) { [void]$dropped.Add($item) } else { $pool.RemoveAt($hit) }
            }
            foreach ($item in $oldItems | Where-Object { $dropped.Contains($_) }) {
                $failures.Add("backlog item dropped without '### Afgerond': $($item.Line)")
            }
        }
    }
}

if ($failures.Count -eq 0) {
    $kept = if ($null -eq $backlog) { 'no backlog section' } else { "Backlog $($newItems.Count) items" }
    $compared = if ($Previous -and $null -ne $backlog) { ", all $($oldItems.Count) previous backlog items accounted for" } else { '' }
    Write-Output "PASS: $Path ($kept, one dated block, Eigen fouten$compared)"
    exit 0
}

Write-Output "FAIL: $Path"
$failures | ForEach-Object { Write-Output "  - $_" }
exit 1
