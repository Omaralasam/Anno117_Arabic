$ErrorActionPreference = "Stop"

$workspace = if ($env:ANNO117_ARABIC_WORKSPACE) { $env:ANNO117_ARABIC_WORKSPACE } else { $PSScriptRoot }

function Get-ConfiguredGameRoot {
    if ($env:ANNO117_GAME_ROOT) {
        return $env:ANNO117_GAME_ROOT
    }

    $gamePathFile = Join-Path $workspace "game-path.txt"
    if (Test-Path -LiteralPath $gamePathFile) {
        $configured = (Get-Content -LiteralPath $gamePathFile -Raw).Trim()
        if ($configured) {
            return $configured
        }
    }

    return $null
}

function Get-BlockingProcesses {
    $labels = @{
        "Anno117" = "Anno 117"
        "UbisoftConnect" = "Ubisoft Connect"
        "UbisoftGameLauncher" = "Ubisoft Connect"
        "upc" = "Ubisoft Connect"
    }

    $open = foreach ($processName in $labels.Keys) {
        if (Get-Process -Name $processName -ErrorAction SilentlyContinue) {
            $labels[$processName]
        }
    }

    return @($open | Select-Object -Unique)
}

$maindata = if ($env:ANNO117_GAME_MAINDATA) {
    $env:ANNO117_GAME_MAINDATA
} elseif ($env:ANNO117_GAME_ROOT) {
    Join-Path $env:ANNO117_GAME_ROOT "maindata"
} else {
    $gameRoot = Get-ConfiguredGameRoot
    if (-not $gameRoot) {
        throw "لم يتم تحديد مكان اللعبة. افتح البرنامج واختر مجلد Anno 117 أولاً."
    }
    Join-Path $gameRoot "maindata"
}
$backupRoot = Join-Path $workspace "backups\existing-slot-arabic"
$latestFile = Join-Path $backupRoot "latest.txt"

if (-not (Test-Path -LiteralPath $latestFile)) {
    throw "لا توجد نسخة احتياطية مسجلة بعد: $latestFile"
}

$backup = (Get-Content -LiteralPath $latestFile -Raw).Trim()
if (-not (Test-Path -LiteralPath $backup)) {
    throw "مجلد النسخة الاحتياطية غير موجود: $backup"
}

$blockingProcesses = Get-BlockingProcesses
if ($blockingProcesses.Count) {
    throw "أغلق $($blockingProcesses -join ' و ') قبل الاستعادة."
}

$fileDbName = if (Test-Path -LiteralPath (Join-Path $backup "file_h.db")) {
    "file_h.db"
} elseif (Test-Path -LiteralPath (Join-Path $backup "file.db")) {
    "file.db"
} elseif (Test-Path -LiteralPath (Join-Path $maindata "file_h.db")) {
    "file_h.db"
} else {
    "file.db"
}

$checksumDbName = if (Test-Path -LiteralPath (Join-Path $backup "checksum_h.db")) {
    "checksum_h.db"
} elseif (Test-Path -LiteralPath (Join-Path $backup "checksum.db")) {
    "checksum.db"
} elseif (Test-Path -LiteralPath (Join-Path $maindata "checksum_h.db")) {
    "checksum_h.db"
} else {
    "checksum.db"
}

Copy-Item -LiteralPath (Join-Path $backup $fileDbName) -Destination (Join-Path $maindata $fileDbName) -Force
Copy-Item -LiteralPath (Join-Path $backup $checksumDbName) -Destination (Join-Path $maindata $checksumDbName) -Force

$targetRda = Join-Path $maindata "file_browse_patterns.rda"
$backupRda = Join-Path $backup "file_browse_patterns.rda"
if (Test-Path -LiteralPath $backupRda) {
    Copy-Item -LiteralPath $backupRda -Destination $targetRda -Force
} elseif (Test-Path -LiteralPath $targetRda) {
    Remove-Item -LiteralPath $targetRda -Force
}

Write-Host "تمت استعادة النسخة الاحتياطية: $backup"
Write-Host "قاعدة الملفات: $fileDbName / $checksumDbName"
