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

$gameRoot = Get-ConfiguredGameRoot
if (-not $gameRoot) {
    throw "لم يتم تحديد مكان اللعبة. افتح البرنامج واختر مجلد Anno 117 أولاً."
}
$maindata = if ($env:ANNO117_GAME_MAINDATA) { $env:ANNO117_GAME_MAINDATA } else { Join-Path $gameRoot "maindata" }
$package = Join-Path $workspace "rda-work\existing-slot-arabic"
$backupRoot = Join-Path $workspace "backups\existing-slot-arabic"

function Get-Sha256([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant()
}

$blockingProcesses = Get-BlockingProcesses
if ($blockingProcesses.Count) {
    throw "أغلق $($blockingProcesses -join ' و ') قبل التثبيت."
}

$fileDbName = if (Test-Path -LiteralPath (Join-Path $maindata "file_h.db")) { "file_h.db" } else { "file.db" }
$checksumDbName = if (Test-Path -LiteralPath (Join-Path $maindata "checksum_h.db")) { "checksum_h.db" } else { "checksum.db" }

$sourceFileDb = Join-Path $package $fileDbName
$sourceChecksumDb = Join-Path $package $checksumDbName
$sourceRda = Join-Path $package "file_browse_patterns.rda"

foreach ($path in @($sourceFileDb, $sourceChecksumDb, $sourceRda)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "ملف الحزمة غير موجود: $path"
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

Write-Host "تم تثبيت التعريب بنجاح."
Write-Host "قاعدة الملفات: $fileDbName / $checksumDbName"
Write-Host "النسخة الاحتياطية: $backup"
Write-Host "إذا ظهرت مشكلة، استخدم زر استعادة آخر نسخة من البرنامج."
