# fix-syntax-error.ps1
$serverFile = "D:\cursor\work\super-agent\vocab-server\server.js"
$lines = [System.IO.File]::ReadAllLines($serverFile, [System.Text.Encoding]::UTF8)

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    # Find the broken block: user_current_profile followed by } then article_text
    if ($line -match "user_current_profile: user_current_profile \|\| ''$") {
        $next = $lines[$i+1]
        $nextNext = $lines[$i+2]
        if ($next -match '^\s*\}$' -and $nextNext -match 'article_text') {
            # Fix: join the closing brace with next field on same line
            $lines[$i] = $line -replace '(\s*)$', ",`n            article_text: articleText || '',`n            content: articleText || ''`n          }"
            $lines[$i+1] = ''
            $lines[$i+2] = ''
            Write-Host "Fixed broken inputs block at line $($i+1)"
            break
        }
    }
}

# Remove empty lines created by removal
$cleanLines = $lines | Where-Object { $_ -ne '' }
[System.IO.File]::WriteAllLines($serverFile, $cleanLines, [System.Text.Encoding]::UTF8)
Write-Host "Done. Total lines: $($cleanLines.Count)"
