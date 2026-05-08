$ErrorActionPreference = "Stop"

$workspace = if ($env:ANNO117_ARABIC_WORKSPACE) { $env:ANNO117_ARABIC_WORKSPACE } else { "C:\Users\Omar-alasam009\Documents\Codex\2026-04-20-rda" }
$maindata = if ($env:ANNO117_GAME_MAINDATA) {
    $env:ANNO117_GAME_MAINDATA
} elseif ($env:ANNO117_GAME_ROOT) {
    Join-Path $env:ANNO117_GAME_ROOT "maindata"
} else {
    "D:\SteamLibrary\steamapps\common\Anno 117 - Pax Romana\maindata"
}
$backupRoot = Join-Path $workspace "backups\existing-slot-arabic"
$latestFile = Join-Path $backupRoot "latest.txt"

if (-not (Test-Path -LiteralPath $latestFile)) {
    throw "No latest backup marker found: $latestFile"
}

$backup = (Get-Content -LiteralPath $latestFile -Raw).Trim()
if (-not (Test-Path -LiteralPath $backup)) {
    throw "Backup folder not found: $backup"
}

foreach ($processName in @("Anno117", "UbisoftConnect", "upc")) {
    if (Get-Process -Name $processName -ErrorAction SilentlyContinue) {
        throw "Close $processName before restoring."
    }
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

Write-Host "Restored backup: $backup"
Write-Host "Database: $fileDbName / $checksumDbName"
