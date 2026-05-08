$ErrorActionPreference = "Stop"

$workspace = if ($env:ANNO117_ARABIC_WORKSPACE) { $env:ANNO117_ARABIC_WORKSPACE } else { "C:\Users\Omar-alasam009\Documents\Codex\2026-04-20-rda" }
$gameRoot = if ($env:ANNO117_GAME_ROOT) { $env:ANNO117_GAME_ROOT } else { "D:\SteamLibrary\steamapps\common\Anno 117 - Pax Romana" }
$maindata = if ($env:ANNO117_GAME_MAINDATA) { $env:ANNO117_GAME_MAINDATA } else { Join-Path $gameRoot "maindata" }
$package = Join-Path $workspace "rda-work\existing-slot-arabic"
$backupRoot = Join-Path $workspace "backups\existing-slot-arabic"

function Get-Sha256([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant()
}

foreach ($processName in @("Anno117", "UbisoftConnect", "upc")) {
    if (Get-Process -Name $processName -ErrorAction SilentlyContinue) {
        throw "Close $processName before installing."
    }
}

$fileDbName = if (Test-Path -LiteralPath (Join-Path $maindata "file_h.db")) { "file_h.db" } else { "file.db" }
$checksumDbName = if (Test-Path -LiteralPath (Join-Path $maindata "checksum_h.db")) { "checksum_h.db" } else { "checksum.db" }

$sourceFileDb = Join-Path $package $fileDbName
$sourceChecksumDb = Join-Path $package $checksumDbName
$sourceRda = Join-Path $package "file_browse_patterns.rda"

foreach ($path in @($sourceFileDb, $sourceChecksumDb, $sourceRda)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing package file: $path"
    }
}

$targetFileDb = Join-Path $maindata $fileDbName
$targetChecksumDb = Join-Path $maindata $checksumDbName
$targetRda = Join-Path $maindata "file_browse_patterns.rda"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Path $backup | Out-Null

Copy-Item -LiteralPath $targetFileDb -Destination (Join-Path $backup $fileDbName) -Force
Copy-Item -LiteralPath $targetChecksumDb -Destination (Join-Path $backup $checksumDbName) -Force
if (Test-Path -LiteralPath $targetRda) {
    Copy-Item -LiteralPath $targetRda -Destination (Join-Path $backup "file_browse_patterns.rda") -Force
}

Copy-Item -LiteralPath $sourceFileDb -Destination $targetFileDb -Force
Copy-Item -LiteralPath $sourceChecksumDb -Destination $targetChecksumDb -Force
Copy-Item -LiteralPath $sourceRda -Destination $targetRda -Force

Set-Content -LiteralPath (Join-Path $backupRoot "latest.txt") -Value $backup -Encoding UTF8

Write-Host "Installed Arabic package."
Write-Host "Database: $fileDbName / $checksumDbName"
Write-Host "Backup: $backup"
Write-Host "If the game fails, run restore_existing_slot_arabic.ps1"
