param(
    [string]$XmlPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($XmlPath)) {
    $XmlPath = Join-Path $PSScriptRoot "anno117-direct-arabic\payload\data\base\config\gui\texts_english.xml"
}

if (-not (Test-Path -LiteralPath $XmlPath)) {
    throw "Missing texts XML: $XmlPath"
}

$lines = Get-Content -LiteralPath $XmlPath -Encoding UTF8
$total = 0
$arabic = 0
$latin = 0
$empty = 0
$unique = New-Object "System.Collections.Generic.HashSet[string]"
$uniqueArabic = New-Object "System.Collections.Generic.HashSet[string]"

foreach ($line in $lines) {
    if ($line -match '^\s*<Text>(.*)</Text>\s*$') {
        $text = $Matches[1].Trim()
        if ($text.Length -eq 0) {
            $empty++
            continue
        }

        $total++
        [void]$unique.Add($text)

        if ($text -match '[\u0600-\u06FF]') {
            $arabic++
            [void]$uniqueArabic.Add($text)
        }

        if ($text -match '[A-Za-z]') {
            $latin++
        }
    }
}

if ($total -eq 0) {
    throw "No text lines found in: $XmlPath"
}

$arabicPercent = [math]::Round(($arabic / [double]$total) * 100, 2)
$uniqueArabicPercent = [math]::Round(($uniqueArabic.Count / [double]$unique.Count) * 100, 2)

[pscustomobject]@{
    XmlPath = (Resolve-Path -LiteralPath $XmlPath).Path
    TotalTextLines = $total
    ArabicTextLines = $arabic
    LatinTextLines = $latin
    EmptyTextLines = $empty
    ArabicPercent = $arabicPercent
    UniqueText = $unique.Count
    UniqueArabic = $uniqueArabic.Count
    UniqueArabicPercent = $uniqueArabicPercent
}
