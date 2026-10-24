# Phase2 readback fix - verify pack cleanliness and mychat/chat recall
# Usage:
#   cd D:\cursor\work\super-agent
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase2-readback.ps1
#   powershell -ExecutionPolicy Bypass -File .\scratch\verify-memory-phase2-readback.ps1 -UserId phase2_write_test

param(
    [string]$UserId = 'phase2_write_test',
    [string]$BaseUrl = 'https://app.liujingzhuwo.site',
    [string]$Query = [string][char]0x6211 + [string][char]0x7EC3 + [string][char]0x53E3 + [string][char]0x8BED + [string][char]0x504F + [string][char]0x597D + [string][char]0x4EC0 + [string][char]0x4E48 + [string][char]0x53E3 + [string][char]0x97F3 + [string][char]0xFF1F
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Title) {
    Write-Host ''
    Write-Host "---- $Title ----" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 1
}

function Pass([string]$Message) {
    Write-Host "PASS: $Message" -ForegroundColor Green
}

# Unicode markers (avoid encoding issues in script file)
$AuthMarker = [string][char]0x3010 + [string][char]0x53E3 + [string][char]0x97F3 + [string][char]0x504F + [string][char]0x597D + [string][char]0xFF08 + [string][char]0x6743 + [string][char]0x5A01 + [string][char]0xFF09 + [string][char]0x3011
$AusMarker = [string][char]0x6FB3 + [string][char]0x5F0F
$YingPattern = [string][char]0x82F1 + [string][char]0x97F3 + '|' + [string][char]0x82F1 + [string][char]0x5F0F + '|accent=UK'
$RecallQuery = [string][char]0x53E3 + [string][char]0x97F3 + ' ' + [string][char]0x504F + [string][char]0x597D

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'Phase2 readback - verify' -ForegroundColor Cyan
Write-Host "UserId: $UserId"
Write-Host '========================================' -ForegroundColor Cyan

Write-Step '1/3 pack-for-llm'
$packUri = "$BaseUrl/api/user/memory/pack-for-llm?userId=$([uri]::EscapeDataString($UserId))&query=$([uri]::EscapeDataString($RecallQuery))&format=json"
$packResp = Invoke-RestMethod -Uri $packUri -TimeoutSec 30
$packText = [string]$packResp.data.text

if (-not $packText) { Fail 'pack-for-llm returned empty text' }

$hasAuth = $packText.Contains($AuthMarker)
$hasAus = $packText.Contains($AusMarker)
$hasYing = $packText -match $YingPattern

Write-Host "pack_len=$($packText.Length)"
Write-Host "has_authority=$hasAuth"
Write-Host "has_aushi=$hasAus"
Write-Host "has_yingyin=$hasYing"
Write-Host ''
Write-Host $packText.Substring(0, [Math]::Min(280, $packText.Length))

if (-not $hasAuth) { Fail 'pack missing authority marker' }
if (-not $hasAus) { Fail 'pack missing AU accent marker' }
if ($hasYing) { Fail 'pack still contains UK/yinying noise' }
Pass 'pack-for-llm is clean and has authoritative AU accent'

Write-Step '2/3 mychat/chat readback'
$bodyObj = @{
    query  = $Query
    userId = $UserId
    inputs = @{ app_user_id = $UserId }
}
$body = $bodyObj | ConvertTo-Json -Depth 5 -Compress
$utf8Body = [System.Text.Encoding]::UTF8.GetBytes($body)

$chatResp = Invoke-RestMethod -Method Post `
    -Uri "$BaseUrl/api/dify/mychat/chat" `
    -ContentType 'application/json; charset=utf-8' `
    -Body $utf8Body `
    -TimeoutSec 120

$answer = [string]$chatResp.answer
if (-not $answer) { Fail 'mychat/chat returned empty answer' }

Write-Host $answer.Substring(0, [Math]::Min(600, $answer.Length))

$answerHasAus = $answer.Contains($AusMarker)
$answerHasYing = $answer -match $YingPattern

if (-not $answerHasAus) { Fail 'readback answer missing AU accent' }
if ($answerHasYing -and -not $answerHasAus) { Fail 'readback answer is UK-only' }
Pass 'mychat/chat readback mentions AU accent'

Write-Step '3/3 summary'
Write-Host 'Phase2 readback verification passed.' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
