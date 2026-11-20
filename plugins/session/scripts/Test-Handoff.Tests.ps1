BeforeAll {
    $checker = Join-Path -Path $PSScriptRoot -ChildPath 'Test-Handoff.ps1'
    $today = Get-Date -Format 'yyyy-MM-dd'

    function Invoke-Checker {
        # Runs the checker as its own process, so its exit code is real and its exit does not end Pester.
        param ([string[]]$Arguments)
        $output = & pwsh -NoProfile -File $checker @Arguments
        [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
    }

    function Write-HandoffFile {
        param ([string]$Name, [string]$Text)
        $path = Join-Path -Path $TestDrive -ChildPath $Name
        $write = @{
            LiteralPath = $path
            Value       = $Text
            Encoding    = 'utf8NoBOM'
        }
        Set-Content @write
        $path
    }

    function Get-LeanHandoff {
        # An invented lean handoff (Contoso).
        param (
            [string]$Date = $today,
            [string]$Backlog = "1. **(Hoog)** Ship the Contoso basket to production.`n2. **(Laag)** Tidy the Contoso logs.",
            [string]$Done = '',
            [string]$Mistakes = 'geen waargenomen',
            # A project whose open work lives in its own backlog tool writes no "## Backlog" section.
            [switch]$NoBacklog
        )
        $doneBlock = if ($Done) { "`n### Afgerond`n`n$Done`n" } else { '' }
        $backlogBlock = if ($NoBacklog) { '' } else { "## Backlog`n`n$Backlog`n`n" }
        "$backlogBlock## $Date`n`nBuilt the Contoso basket.`n$doneBlock`n## Eigen fouten`n`n$Mistakes`n"
    }
}

Describe 'Test-Handoff.ps1' {
    It 'passes a lean handoff with a backlog, one block of today and own mistakes' {
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'lean.md' -Text (Get-LeanHandoff)))
        $result.Output | Should -Match '^PASS'
        $result.ExitCode | Should -Be 0
    }

    It 'passes a handoff without a backlog section, for a project whose open work lives in its own backlog' {
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'nobacklog.md' -Text (Get-LeanHandoff -NoBacklog)))
        $result.Output | Should -Match '^PASS'
        $result.ExitCode | Should -Be 0
    }

    It 'compares nothing when the backlog moved out with -BacklogMoved, although the previous version had one' {
        $previous = Write-HandoffFile -Name 'before-moved.md' -Text (Get-LeanHandoff -Date '2026-10-16')
        $path = Write-HandoffFile -Name 'after-moved.md' -Text (Get-LeanHandoff -NoBacklog)
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', $previous, '-BacklogMoved')
        $result.Output | Should -Match '^PASS'
        $result.Output | Should -Match 'no backlog section'
        $result.ExitCode | Should -Be 0
    }

    It 'fails a backlog section that disappeared without -BacklogMoved' {
        $previous = Write-HandoffFile -Name 'before-gone.md' -Text (Get-LeanHandoff -Date '2026-10-16')
        $path = Write-HandoffFile -Name 'after-gone.md' -Text (Get-LeanHandoff -NoBacklog)
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', $previous)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'previous version has 2 backlog items and this one has no "## Backlog"'
    }

    It 'compares a new backlog heading with trailing text, and names the item it dropped' {
        $previous = Write-HandoffFile -Name 'before-open.md' -Text (Get-LeanHandoff -Date '2026-10-16')
        $after = (Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.') -replace '## Backlog', '## Backlog (open)'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after-open.md' -Text $after), '-Previous', $previous)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape("backlog item dropped without '### Afgerond': 2. **(Laag)** Tidy the Contoso logs."))
    }

    It 'still fails a handoff without a backlog when it misses its dated block or its own mistakes' {
        $text = "## Eigen fouten`n`n`n"
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'nobacklog-bad.md' -Text $text))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'exactly one dated block'
        $result.Output | Should -Match 'Eigen fouten" is empty'
    }

    It 'ignores the YAML frontmatter of a memory file' {
        $text = "---`nid: 00000001-0000-4000-8000-000000000000`nsummary: Basket half done.`n---`n`n" + (Get-LeanHandoff)
        (Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'memory.md' -Text $text))).ExitCode | Should -Be 0
    }

    It 'fails two dated blocks, because a lean handoff keeps only the latest session' {
        $text = (Get-LeanHandoff) + "`n## 2026-10-01`n`nAn older Contoso session.`n"
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'two.md' -Text $text))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'exactly one dated block'
    }

    It 'fails an older dated block, unless -Migration' {
        $path = Write-HandoffFile -Name 'old.md' -Text (Get-LeanHandoff -Date '2026-10-01')
        $result = Invoke-Checker -Arguments @('-Path', $path)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'not today'
        (Invoke-Checker -Arguments @('-Path', $path, '-Migration')).ExitCode | Should -Be 0
    }

    It 'fails a backlog without a numbered item and empty own mistakes' {
        $path = Write-HandoffFile -Name 'empty.md' -Text (Get-LeanHandoff -Backlog 'Nothing left for Contoso.' -Mistakes '')
        $result = Invoke-Checker -Arguments @('-Path', $path)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'no numbered item'
        $result.Output | Should -Match 'Eigen fouten" is empty'
    }

    It 'fails when a previous backlog item is gone without a line under Afgerond, and names it' {
        $previous = Write-HandoffFile -Name 'before.md' -Text (Get-LeanHandoff -Date '2026-10-16')
        $path = Write-HandoffFile -Name 'after.md' -Text (Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.')
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', $previous)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape("backlog item dropped without '### Afgerond': 2. **(Laag)** Tidy the Contoso logs."))
    }

    It 'passes when that item is under Afgerond, starting with the same words' {
        $previous = Write-HandoffFile -Name 'before2.md' -Text (Get-LeanHandoff -Date '2026-10-16')
        $after = Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.' -Done '- Tidy the Contoso logs: done, rotated weekly.'
        (Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after2.md' -Text $after), '-Previous', $previous)).ExitCode | Should -Be 0
    }

    It 'passes an item that was renumbered and reprioritised, and ignores dropped sub-items' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1. **(Hoog)** Ship the Contoso basket to production.`n   1. Ask Contoso for a release slot.`n2. **(Laag)** Tidy the Contoso logs."
        $after = Get-LeanHandoff -Backlog "1. **(Middel)** Tidy the Contoso logs.`n2. **(Hoog)** Ship the Contoso basket to production, after the freeze."
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after3.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before3.md' -Text $before))
        $result.Output | Should -Match '^PASS'
        $result.ExitCode | Should -Be 0
    }

    It 'fails when the previous version is missing' {
        $path = Write-HandoffFile -Name 'lean2.md' -Text (Get-LeanHandoff)
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', (Join-Path -Path $TestDrive -ChildPath 'nowhere.md'))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'previous version not found'
    }

    It 'reads an old-format handoff as the previous version' {
        $old = "## Startpunt`n`nContoso basket half done.`n`n## 2026-10-15`n`nOlder.`n`n## 2026-10-16`n`nOld log.`n`n## Backlog`n`n1. **(Hoog)** Ship the Contoso basket to production.`n`n## Lessen`n`n- A Contoso lesson.`n`n## Eigen fouten`n`n- A Contoso mistake.`n"
        $lean = Get-LeanHandoff -Date '2026-10-16' -Backlog '1. **(Hoog)** Ship the Contoso basket to production.'
        $arguments = @('-Path', (Write-HandoffFile -Name 'lean3.md' -Text $lean), '-Previous', (Write-HandoffFile -Name 'old.md' -Text $old), '-Migration')
        (Invoke-Checker -Arguments $arguments).ExitCode | Should -Be 0
    }

    It 'reads the backlog of an old-format previous version, and names an item dropped from it' {
        $old = "## Startpunt`n`nContoso basket half done.`n`n## 2026-10-16`n`nOld log.`n`n## Backlog`n`n1. **(Hoog)** Ship the Contoso basket to production.`n2. **(Laag)** Archive the Contoso invoices.`n`n## Lessen`n`n- A Contoso lesson.`n`n## Eigen fouten`n`n- A Contoso mistake.`n"
        $lean = Get-LeanHandoff -Date '2026-10-16' -Backlog '1. **(Hoog)** Ship the Contoso basket to production.'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'lean4.md' -Text $lean), '-Previous', (Write-HandoffFile -Name 'old2.md' -Text $old), '-Migration')
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('2. **(Laag)** Archive the Contoso invoices.'))
    }

    It 'fails when the previous version has no backlog to compare with' {
        $path = Write-HandoffFile -Name 'lean5.md' -Text (Get-LeanHandoff)
        $empty = Write-HandoffFile -Name 'empty-previous.md' -Text ''
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', $empty)
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match 'previous version has no numbered backlog item'
    }

    It 'reads a previous backlog heading with trailing text' {
        $previous = (Get-LeanHandoff -Date '2026-10-16') -replace '## Backlog', '## Backlog (open)'
        $path = Write-HandoffFile -Name 'after5.md' -Text (Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.')
        $result = Invoke-Checker -Arguments @('-Path', $path, '-Previous', (Write-HandoffFile -Name 'before5.md' -Text $previous))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('2. **(Laag)** Tidy the Contoso logs.'))
    }

    It 'lets one new item account for one old item only, the most specific first' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1. **(Hoog)** Test the Contoso basket on dev.`n2. **(Hoog)** Test the Contoso basket on prod.`n3. **(Hoog)** Release.`n4. **(Laag)** Release notes for Contoso."
        $after = Get-LeanHandoff -Backlog "1. **(Hoog)** Test the Contoso basket on dev.`n2. **(Laag)** Release notes for Contoso."
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after6.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before6.md' -Text $before))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('2. **(Hoog)** Test the Contoso basket on prod.'))
        $result.Output | Should -Match ([regex]::Escape('3. **(Hoog)** Release.'))
        $result.Output | Should -Not -Match ([regex]::Escape('on dev.'))
        $result.Output | Should -Not -Match ([regex]::Escape('Release notes for Contoso.'))
    }

    It 'names the dropped item, not the kept one, when two items share their first five words' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1. **(Hoog)** Test the Contoso basket on dev.`n2. **(Hoog)** Test the Contoso basket on prod."
        $after = Get-LeanHandoff -Backlog '1. **(Hoog)** Test the Contoso basket on prod.'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after9.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before9.md' -Text $before))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('1. **(Hoog)** Test the Contoso basket on dev.'))
        $result.Output | Should -Not -Match ([regex]::Escape('on prod.'))
    }

    It 'reads tilde fences and indented closing fences in the previous backlog' {
        # An unclosed-looking fence (closed with indent) would pair with the bash fence further down and swallow items.
        $backlog = "1. **(Hoog)** Ship the Contoso basket to production. Example:`n``````text`nx`n   ```````n2. **(Laag)** Tidy the Contoso logs.`n~~~text`n## Output`n~~~`n3. **(Laag)** Rotate the Contoso keys."
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog $backlog -Mistakes "geen waargenomen`n``````bash`necho done`n```````n"
        $after = Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after10.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before10.md' -Text $before))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('2. **(Laag)** Tidy the Contoso logs.'))
        $result.Output | Should -Match ([regex]::Escape('3. **(Laag)** Rotate the Contoso keys.'))
    }

    It 'names a dropped 1) item literally' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1) **(Laag)** Tidy the Contoso logs.`n2. **(Hoog)** Ship the Contoso basket to production."
        $after = Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after11.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before11.md' -Text $before))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('1) **(Laag)** Tidy the Contoso logs.'))
    }

    It 'writes a dropped line in UTF-8, also when the console code page is 437' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1. **(Hoog)** Verifiëren → één map… klaar.`n2. **(Laag)** Tidy the Contoso logs."
        $after = Get-LeanHandoff -Backlog '1. **(Laag)** Tidy the Contoso logs.'
        $arguments = @('-NoProfile', '-File', $checker, '-Path', (Write-HandoffFile -Name 'after12.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before12.md' -Text $before))
        $original = [Console]::OutputEncoding
        try {
            # The checker must set UTF-8 itself; a console left on 65001 by an earlier run would hide that.
            [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(437)
            $start = [System.Diagnostics.ProcessStartInfo]::new('pwsh')
            foreach ($argument in $arguments) { $start.ArgumentList.Add($argument) }
            $start.RedirectStandardOutput = $true
            $start.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
            $start.UseShellExecute = $false
            $process = [System.Diagnostics.Process]::Start($start)
            $output = $process.StandardOutput.ReadToEnd()
            $process.WaitForExit()
        }
        finally {
            [Console]::OutputEncoding = $original
        }
        $output | Should -Match ([regex]::Escape('Verifiëren → één map… klaar.'))
    }

    It 'strips other priority markers before comparing' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1. [hoog] **Verify the Contoso pc** before Friday.`n2. **Hoog** — Rotate the Contoso keys now.`n3. **P1 — Close the Contoso tickets** this week."
        $after = Get-LeanHandoff -Backlog "1. **(Hoog)** Verify the Contoso pc before Friday.`n2. **(Hoog)** Rotate the Contoso keys now.`n3. **(Hoog)** Close the Contoso tickets this week."
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after7.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before7.md' -Text $before))
        $result.Output | Should -Match '^PASS'
        $result.ExitCode | Should -Be 0
    }

    It 'refuses an empty -Previous instead of skipping the comparison' {
        $path = Write-HandoffFile -Name 'lean6.md' -Text (Get-LeanHandoff)
        (Invoke-Checker -Arguments @('-Path', $path, '-Previous', '')).ExitCode | Should -Be 1
    }

    It 'reads 1) items and items after a fenced block in the previous backlog' {
        $before = Get-LeanHandoff -Date '2026-10-16' -Backlog "1) **(Hoog)** Ship the Contoso basket to production.`n``````text`n## not a heading`n```````n2. **(Laag)** Tidy the Contoso logs."
        $after = Get-LeanHandoff -Backlog '1. **(Hoog)** Ship the Contoso basket to production.'
        $result = Invoke-Checker -Arguments @('-Path', (Write-HandoffFile -Name 'after8.md' -Text $after), '-Previous', (Write-HandoffFile -Name 'before8.md' -Text $before))
        $result.ExitCode | Should -Be 1
        $result.Output | Should -Match ([regex]::Escape('2. **(Laag)** Tidy the Contoso logs.'))
    }
}
