param(
    [string]$Source = "D:\cursor\work\super-agent",
    [string]$TargetHost = "ubuntu@150.158.34.217",
    [string]$TargetDir = "/home/ubuntu/super-agent",
    [string[]]$Files = @()
)

$filesToSync = @(
    "vocab-server/services/audioTranscriptionService.js",
    "vocab-server/server.js",
    "src/services/ttsAPI.ts",
    "src/services/listeningAPI.ts",
    "src/components/BlindListeningCabin.tsx",
    "vocab-server/tests/listenUploadStress.test.js"
)

$remotePath = $TargetDir
Write-Output "Starting sync to $TargetHost"

foreach ($file in $filesToSync) {
    $localPath = Join-Path $Source $file
    if (Test-Path $localPath) {
        $remoteFile = Join-Path $remotePath $file
        Write-Output "Syncing: $file"
        # Upload using scp with password authentication
        $cmd = "scp -o StrictHostKeyChecking=no -o PasswordAuthentication=yes `"@localPath`" `"$TargetHost`:$remoteFile`""
        # Use plink or sshpass alternative
        Write-Output "Would execute: $cmd"
    } else {
        Write-Warning "File not found: $localPath"
    }
}

Write-Output "Sync completed"
