# Resolve a working local HTTP proxy for Git.
# Priority: 127.0.0.1:10808 -> 127.0.0.1:7897 -> direct (empty).
#
# Apply to current repo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\resolve-git-proxy.ps1"
#
# Dot-source helpers:
#   . .\scripts\resolve-git-proxy.ps1
#   $proxy = Get-ResolvedGitProxy
#   Set-LocalGitProxy

param(
    [switch]$Apply
)

function Test-LocalTcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 400
    )
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $ok) {
            $client.Close()
            return $false
        }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Get-ResolvedGitProxy {
    $candidates = @(
        @{ Port = 10808; Url = 'http://127.0.0.1:10808' },
        @{ Port = 7897;  Url = 'http://127.0.0.1:7897' }
    )
    foreach ($c in $candidates) {
        if (Test-LocalTcpPort -HostName '127.0.0.1' -Port $c.Port) {
            return $c.Url
        }
    }
    return ''
}

function Set-LocalGitProxy {
    param(
        [string]$ProxyUrl = $(Get-ResolvedGitProxy)
    )
    if ($ProxyUrl) {
        git config --local http.proxy $ProxyUrl
        git config --local https.proxy $ProxyUrl
        Write-Host ("Git proxy -> " + $ProxyUrl) -ForegroundColor Green
    } else {
        git config --local --unset-all http.proxy 2>$null | Out-Null
        git config --local --unset-all https.proxy 2>$null | Out-Null
        Write-Host 'Git proxy -> direct (no local proxy listening on 10808/7897)' -ForegroundColor Yellow
    }
    return $ProxyUrl
}

# Default when executed as a file: apply to this repo
if ($MyInvocation.InvocationName -ne '.' -and $MyInvocation.Line -notmatch '^\s*\.\s+') {
    $repoRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $repoRoot
    Set-LocalGitProxy | Out-Null
}
