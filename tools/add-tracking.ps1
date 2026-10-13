$ErrorActionPreference = 'Stop'
$sitePath = Join-Path $PSScriptRoot '..\site'
$utf8 = New-Object Text.UTF8Encoding($false)
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\tracking') -Destination $sitePath -Recurse -Force
Get-ChildItem -LiteralPath $sitePath -Recurse -File -Filter '*.html' | ForEach-Object {
    $html = [IO.File]::ReadAllText($_.FullName)
    if ($html.Contains('/tracking/analytics.js') -or $html -match '(?i)<meta http-equiv="refresh"') { return }
    if ($html -notmatch '(?i)</head>') { throw "Missing head: $($_.Name)" }
    $html = [regex]::Replace($html, '(?i)</head>', '<script src="/tracking/analytics.js" defer></script></head>')
    [IO.File]::WriteAllText($_.FullName, $html, $utf8)
}
