# ============================================================
# Super-Agent PuTTY/SSH 一键智能部署 (免安装 PuTTY，原生 Paramiko 引擎)
# ============================================================
param(
    [string]$SSHPassword = "19890430@lmq",
    [switch]$SkipFrontendBuild = $false,
    [string]$CommitMessage = "feat(xf-feed-02): upload book/video mindmap deepen and hardness gates"
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = 'D:\cursor\work\super-agent'
$PythonExe = 'C:\Users\lzhumy\AppData\Local\Programs\Python\Python310\python.exe'

if (-not (Test-Path $PythonExe)) {
    $PythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
}

Set-Location $ProjectRoot

$pyArgs = @(
    "scripts\deploy_runner.py",
    "--password", $SSHPassword,
    "--message", $CommitMessage
)

if ($SkipFrontendBuild) {
    $pyArgs += "--skip-frontend"
}

& $PythonExe @pyArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
