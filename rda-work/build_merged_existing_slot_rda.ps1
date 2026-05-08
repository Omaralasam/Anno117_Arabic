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

$mainData = if ($env:ANNO117_GAME_MAINDATA) {
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
$sourceRda = Join-Path $mainData "file_browse_patterns.rda"
$payload = Join-Path $PSScriptRoot "anno117-direct-arabic\payload"
$mergedPayload = Join-Path $PSScriptRoot "merged-file-browse-patterns-payload"
$directRda = Join-Path $PSScriptRoot "anno117-direct-arabic\data99.rda"

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

foreach ($dll in @("AnnoRDA.dll", "AnnoRDA.FileDB.dll", "AnnoRDA.ChecksumDB.dll", "RDAExplorer.dll")) {
    [Reflection.Assembly]::LoadFrom((Join-Path $toolRoot $dll)) | Out-Null
}

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Export-Folder($Folder, [string]$RelativePrefix, [string]$OutputRoot) {
    foreach ($file in @($Folder.Files)) {
        $relative = ($RelativePrefix + $file.Name).Replace("/", "\")
        $target = Join-Path $OutputRoot $relative
        Ensure-Directory ([System.IO.Path]::GetDirectoryName($target))

        $inStream = $file.ContentsSource.GetReadStream()
        $outStream = [System.IO.File]::Open($target, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        try {
            $inStream.CopyTo($outStream)
        }
        finally {
            $outStream.Dispose()
            $inStream.Dispose()
        }
    }

    foreach ($folder in @($Folder.Folders)) {
        Export-Folder $folder ($RelativePrefix + $folder.Name + "/") $OutputRoot
    }
}

function Copy-PayloadOverlay([string]$SourceRoot, [string]$OutputRoot) {
    foreach ($file in @(Get-ChildItem -LiteralPath $SourceRoot -Recurse -File)) {
        $relative = $file.FullName.Substring($SourceRoot.Length + 1)
        $target = Join-Path $OutputRoot $relative
        Ensure-Directory ([System.IO.Path]::GetDirectoryName($target))
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }
}

if (-not (Test-Path -LiteralPath $sourceRda)) {
    throw "أرشيف اللعبة غير موجود: $sourceRda"
}
if (-not (Test-Path -LiteralPath $payload)) {
    throw "ملفات التعريب غير موجودة: $payload"
}

if (Test-Path -LiteralPath $mergedPayload) {
    Remove-Item -LiteralPath $mergedPayload -Recurse -Force
}
Ensure-Directory $mergedPayload

$loader = New-Object AnnoRDA.Loader.ContainerFileLoader
$fileSystem = $loader.Load($sourceRda)
Export-Folder $fileSystem.Root "" $mergedPayload
Copy-PayloadOverlay $payload $mergedPayload

$reader = New-Object RDAExplorer.RDAReader
$reader.FileName = $sourceRda
$reader.ReadRDAFile()
$version = $reader.rdaFolder.Version
$reader.Dispose()

$fileList = New-Object "System.Collections.Generic.List[RDAExplorer.RDAFile]"
foreach ($file in @(Get-ChildItem -LiteralPath $mergedPayload -Recurse -File)) {
    $relative = $file.FullName.Substring($mergedPayload.Length + 1).Replace("\", "/")
    $relativeDir = [System.IO.Path]::GetDirectoryName($relative)
    if ($null -eq $relativeDir) { $relativeDir = "" }
    $relativeFolder = $relativeDir.Replace("\", "/")
    $entry = [RDAExplorer.RDAFile]::Create($version, $file.FullName, $relativeFolder)
    [void]$fileList.Add($entry)
}

$folder = [RDAExplorer.RDAFolder]::GenerateFrom($fileList, $version)
$writer = New-Object RDAExplorer.RDAWriter($folder)
$emptyReader = New-Object RDAExplorer.RDAReader
$writer.Write($directRda, $version, $false, $emptyReader, $null)

$originalCount = @(Get-ChildItem -LiteralPath $mergedPayload\filebrowsercache -File -ErrorAction SilentlyContinue).Count
$payloadCount = @(Get-ChildItem -LiteralPath $payload -Recurse -File).Count
Write-Host "تم بناء أرشيف التعريب المدمج:"
Write-Host "  $directRda"
Write-Host "  عدد الملفات: $($fileList.Count)"
Write-Host "  ملفات filebrowsercache الأصلية: $originalCount"
Write-Host "  ملفات التعريب: $payloadCount"
