# PowerShell script to unlock theme mastery (Pure ASCII to avoid encoding issues)

$BaseUrl = "https://app.liujingzhuwo.site"
$UserId = "default-user"
$Theme = "跨部门协调：资源争夺"
$Today = (Get-Date).ToString("yyyy-MM-dd")

Write-Host "--------------------------------------------------"
Write-Host "Starting theme mastery unlock injection..."
Write-Host "Target Theme: $Theme"
Write-Host "--------------------------------------------------"

try {
    # 2. Get sessionId
    $SessionBody = @{
        userId = $UserId
        trainingDate = $Today
    }
    $SessionResponse = Invoke-RestMethod -Uri "$BaseUrl/api/training/session/upsert" -Method Post -ContentType "application/json" -Body (ConvertTo-Json $SessionBody)
    $SessionId = $SessionResponse.sessionId
    Write-Host "Session ID retrieved: $SessionId"

    # 3. Inject 10 oral attempts
    Write-Host "Injecting 10 oral attempts..."
    for ($i = 1; $i -le 10; $i++) {
        $Body = @{
            sessionId = $SessionId
            userId = $UserId
            moduleType = "oral"
            sceneType = $Theme
            caseText = "Oral attempt round $i"
            userAnswer = @{ text = "Mock user oral response for round $i" }
            durationSeconds = 15
        }
        $Res = Invoke-RestMethod -Uri "$BaseUrl/api/training/attempt" -Method Post -ContentType "application/json" -Body (ConvertTo-Json $Body)
        Write-Host "-> Oral attempt $i added. AttemptId: $($Res.attemptId)"
    }

    # 4. Inject 1 high-score write attempt (score: 8.5)
    Write-Host "Injecting L3 write attempt..."
    $WriteBody = @{
        sessionId = $SessionId
        userId = $UserId
        moduleType = "write"
        sceneType = $Theme
        caseText = "Write report"
        userAnswer = @{ text = "Regarding the resource conflict between departments, I suggest we hold a weekly alignment meeting and redistribute the headcount." }
        durationSeconds = 120
        score = 8.5
    }
    $WriteRes = Invoke-RestMethod -Uri "$BaseUrl/api/training/attempt" -Method Post -ContentType "application/json" -Body (ConvertTo-Json $WriteBody)
    Write-Host "-> Write attempt added. Score: 8.5, AttemptId: $($WriteRes.attemptId)"

    # 5. Verify mastery status
    Write-Host "--------------------------------------------------"
    Write-Host "Verifying mastery status from server..."
    
    # Use escaped URI to avoid '&' operator issues in PowerShell
    $EscapedTheme = [URI]::EscapeDataString($Theme)
    $CheckUrl = "$BaseUrl/api/theme/check-mastery?theme=$EscapedTheme&userId=$UserId"
    
    $Mastery = Invoke-RestMethod -Uri $CheckUrl
    Write-Host "Mastery Check Results:"
    Write-Host "Theme      : $($Mastery.theme)"
    Write-Host "Oral Count : $($Mastery.oralCount) (Passed: $($Mastery.oralPassed))"
    Write-Host "Write Score: $($Mastery.maxWriteScore)"
    if ($Mastery.isMastered) {
        Write-Host "STATUS     : UNLOCKED SUCCESSFULLY!" -ForegroundColor Green
    } else {
        Write-Host "STATUS     : FAILED TO UNLOCK." -ForegroundColor Red
    }
    Write-Host "--------------------------------------------------"
} catch {
    Write-Error "Error occurred during unlock: $_"
}
