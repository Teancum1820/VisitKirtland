$ErrorActionPreference = 'Stop'
$sitePath = Join-Path $PSScriptRoot '..\site'
$snippet = '<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=''{"token":"ab836cb21b1b4e46a1c3a2dd75b0ff90"}''></script><!-- End Cloudflare Web Analytics -->'
$utf8 = New-Object Text.UTF8Encoding($false)

Get-ChildItem -LiteralPath $sitePath -Recurse -File -Filter '*.html' | ForEach-Object {
    $html = [IO.File]::ReadAllText($_.FullName)
    if ($html.Contains('static.cloudflareinsights.com/beacon.min.js')) { return }
    if ($html -notmatch '(?i)</body>') { throw "Missing closing body tag: $($_.FullName)" }
    $html = [regex]::Replace($html, '(?i)</body>', "$snippet`n</body>")
    [IO.File]::WriteAllText($_.FullName, $html, $utf8)
}
