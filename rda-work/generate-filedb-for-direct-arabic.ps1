$ErrorActionPreference = "Stop"

$workspace = if ($env:ANNO117_ARABIC_WORKSPACE) { $env:ANNO117_ARABIC_WORKSPACE } else { Split-Path -Parent $PSScriptRoot }
$toolRoot = Join-Path $workspace "tools\RDAExplorer"

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
$directRda = Join-Path $workspace "rda-work\anno117-direct-arabic\data99.rda"
$outputFileDb = Join-Path $workspace "rda-work\anno117-direct-arabic\file.db"
$outputChecksumDb = Join-Path $workspace "rda-work\anno117-direct-arabic\checksum.db"

function Unblock-LocalToolFiles([string]$Path) {
    if (-not (Get-Command Unblock-File -ErrorAction SilentlyContinue)) {
        return
    }

    foreach ($file in @(Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue)) {
        try {
            Unblock-File -LiteralPath $file.FullName -ErrorAction SilentlyContinue
        }
        catch {
            # Some file systems do not support zone metadata.
        }
    }
}

Unblock-LocalToolFiles $toolRoot

[Reflection.Assembly]::LoadFrom((Join-Path $toolRoot "AnnoRDA.dll")) | Out-Null
[Reflection.Assembly]::LoadFrom((Join-Path $toolRoot "AnnoRDA.FileDB.dll")) | Out-Null
[Reflection.Assembly]::LoadFrom((Join-Path $toolRoot "AnnoRDA.ChecksumDB.dll")) | Out-Null

if (-not (Test-Path -LiteralPath $directRda)) {
    throw "أرشيف التعريب غير موجود: $directRda"
}

$rdaPaths = New-Object System.Collections.Generic.List[string]
foreach ($file in Get-ChildItem -LiteralPath $maindata -Filter "*.rda" -File) {
    [void]$rdaPaths.Add($file.FullName)
}
$sortedPaths = @([AnnoRDA.Loader.ContainerDirectoryLoader]::SortContainerPaths($rdaPaths))
# Anno 117 archives are named by feature (config.rda, ui.rda, ...), so data99.rda
# sorts before them alphabetically. Load the Arabic override archive last.
$sortedPaths = @($sortedPaths + $directRda)

$archiveFiles = New-Object AnnoRDA.FileDB.Writer.ArchiveFileMap
$fileSystem = New-Object AnnoRDA.FileSystem
$fileLoader = New-Object AnnoRDA.Loader.ContainerFileLoader

foreach ($path in $sortedPaths) {
    $name = [System.IO.Path]::GetFileName($path)
    Write-Host "Loading $name"
    $archiveFiles.Add($path, $name)
    $containerFileSystem = $fileLoader.Load($path)
    $fileSystem.OverwriteWith($containerFileSystem, $null, [System.Threading.CancellationToken]::None)
}

Write-Host "Writing file.db"
$fileDbStream = [System.IO.File]::Open($outputFileDb, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite)
try {
    $fileDbWriter = New-Object AnnoRDA.FileDB.Writer.FileSystemWriter($fileDbStream, $true)
    $fileDbWriter.WriteFileSystem($fileSystem, $archiveFiles)

    Write-Host "Writing checksum.db"
    $fileDbStream.Position = 0
    $checksum = [AnnoRDA.ChecksumDB.Generator]::ComputeChecksum($fileDbStream)
}
finally {
    $fileDbStream.Dispose()
}

$checksumDbStream = [System.IO.File]::Open($outputChecksumDb, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
    $checksumDbWriter = New-Object System.IO.BinaryWriter($checksumDbStream)
    $checksumDbWriter.Write($checksum)
}
finally {
    $checksumDbStream.Dispose()
}

Get-Item -LiteralPath $outputFileDb, $outputChecksumDb | Select-Object FullName,Length,LastWriteTime
