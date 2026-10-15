$ErrorActionPreference = 'Stop'
$sitePath = Join-Path $PSScriptRoot '..\site'
$utf8 = New-Object Text.UTF8Encoding($false)
$privacyPath = Join-Path $sitePath 'privacy'
New-Item -ItemType Directory -Path $privacyPath -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\content\privacy.html') -Destination (Join-Path $privacyPath 'index.html') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\tracking') -Destination $sitePath -Recurse -Force
Get-ChildItem -LiteralPath $sitePath -Recurse -File -Filter '*.html' | ForEach-Object {
    $html = [IO.File]::ReadAllText($_.FullName)
    if ($html -match '(?i)<meta http-equiv="refresh"') { return }
    # Only the existing family-reunion registration CTAs. These are historical
    # 2026 navigation intent; the separate app provides no verified success hook.
    $relativePath = $_.FullName.Substring([IO.Path]::GetFullPath($sitePath).Length).Replace('\', '/')
    $pageUrl = [Uri]::new('https://www.visitkirtland.com' + $relativePath)
    $script:trackingButtonIndex = 0
    $html = [regex]::Replace($html, '<a\b[^>]*\bhref=(["''])(.*?)\1[^>]*>', {
        param($match)
        if ($match.Value.Contains('data-analytics-event')) { return $match.Value }
        try { $destination = [Uri]::new($pageUrl, $match.Groups[2].Value) } catch { return $match.Value }
        if ($destination.Host -notin @('visitkirtland.com', 'www.visitkirtland.com') -or
            $destination.AbsolutePath -notin @('/family-reunion/2026-registration/', '/2026-family-reunions/app/')) { return $match.Value }
        $script:trackingButtonIndex++
        $button = ($relativePath -replace '[^a-zA-Z0-9]+', '_') + '_family_registration_' + $script:trackingButtonIndex
        return $match.Value.Substring(0, $match.Value.Length - 1) + ' data-analytics-event="registration_button_click" data-analytics-key="family_reunion_2026" data-analytics-button="' + $button + '">'
    })
    if ($html -notmatch '(?i)</head>') { throw "Missing head: $($_.Name)" }
    if (-not $html.Contains('/tracking/analytics.js')) {
        $html = [regex]::Replace($html, '(?i)</head>', '<script src="/tracking/analytics.js" defer></script></head>')
    }
    [IO.File]::WriteAllText($_.FullName, $html, $utf8)
}
