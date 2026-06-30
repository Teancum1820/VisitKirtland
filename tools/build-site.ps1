$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$rootPath = [IO.Path]::GetFullPath($root.Path)
$siteDir = Join-Path $rootPath 'site'
$sitePath = [IO.Path]::GetFullPath($siteDir)

if (-not $sitePath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside repository root: $sitePath"
}

if (Test-Path -LiteralPath $sitePath) {
    Remove-Item -LiteralPath $sitePath -Recurse -Force
}

New-Item -ItemType Directory -Path $sitePath -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $rootPath 'assets') -Destination $sitePath -Recurse -Force

$utf8 = New-Object Text.UTF8Encoding($false)
$assetVersion = '20260630.4'
$routeMap = @{}
$mirrorRoot = Join-Path $rootPath 'assets\mirrored-images'

New-Item -ItemType Directory -Path $mirrorRoot -Force | Out-Null

$script:assetDownloadCache = @{}

function Add-Route([string]$path, [string]$output) {
    $normalized = if ($path -eq '/') { '/' } else { '/' + $path.Trim('/').ToLowerInvariant() }
    $script:routeMap[$normalized] = $output
}

$pages = @(
    [pscustomobject]@{ Source = 'VK2.0\home.html'; Type = 'embedded'; Output = 'index.html'; NavKey = 'home' },
    [pscustomobject]@{ Source = 'VK2.0\home.html'; Type = 'embedded'; Output = 'home\index.html'; NavKey = 'home' },
    [pscustomobject]@{ Source = 'VK2.0\kirtland-heritage-days 2026-kirtland-heritage-days.html'; Type = 'embedded'; Output = 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html'; NavKey = 'heritage-2026' },
    [pscustomobject]@{ Source = 'VK2.0\kirtland-heritage-days 2025-kirtland-heritage-days.html'; Type = 'embedded'; Output = 'kirtland-heritage-days\2025-kirtland-heritage-days\index.html'; NavKey = 'heritage-2025' },
    [pscustomobject]@{ Source = 'VK2.0\kirtland-heritage-days 2024-kirtland-heritage-days.html'; Type = 'embedded'; Output = 'kirtland-heritage-days\2024-kirtland-heritage-days\index.html'; NavKey = 'heritage-2024' },
    [pscustomobject]@{ Source = 'VK2.0\church-history-locations.html'; Type = 'embedded'; Output = 'church-history-locations\index.html'; NavKey = 'history' },
    [pscustomobject]@{ Source = 'VK2.0\local-houses-of-worship.html'; Type = 'embedded'; Output = 'local-houses-of-worship\index.html'; NavKey = 'worship' },
    [pscustomobject]@{ Source = 'VK2.0\things-to-do-near-cleveland.html'; Type = 'embedded'; Output = 'things-to-do-near-cleveland\index.html'; NavKey = 'things' },
    [pscustomobject]@{ Source = 'VK2.0\lodging.html'; Type = 'embedded'; Output = 'lodging\index.html'; NavKey = 'lodging' },
    [pscustomobject]@{ Source = 'VK2.0\restaurants.html'; Type = 'embedded'; Output = 'restaurants\index.html'; NavKey = 'dining' },
    [pscustomobject]@{ Source = 'VK2.0\2026-family-reunions.html'; Type = 'embedded'; Output = '2026-family-reunions\index.html'; NavKey = 'family' },
    [pscustomobject]@{ Source = 'Harris Reunion.html'; Type = 'full'; Output = 'family-reunion\harris-reunion\index.html'; NavKey = 'family' },
    [pscustomobject]@{ Source = 'Millet Reunion.html'; Type = 'full'; Output = 'family-reunion\millet-reunion\index.html'; NavKey = 'family' },
    [pscustomobject]@{ Source = 'Millet Reunion.html'; Type = 'full'; Output = 'family-reunion\millett-reunion\index.html'; NavKey = 'family' }
)

Add-Route '/' 'index.html'
Add-Route '/home' 'home\index.html'
Add-Route '/kirtland-heritage-days/2026-kirtland-heritage-days' 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html'
Add-Route '/kirtland-heritage-days/2027-kirtland-heritage-days' 'kirtland-heritage-days\2027-kirtland-heritage-days\index.html'
Add-Route '/kirtland-heritage-days/2025-kirtland-heritage-days' 'kirtland-heritage-days\2025-kirtland-heritage-days\index.html'
Add-Route '/kirtland-heritage-days/2024-kirtland-heritage-days' 'kirtland-heritage-days\2024-kirtland-heritage-days\index.html'
Add-Route '/church-history-locations' 'church-history-locations\index.html'
Add-Route '/local-houses-of-worship' 'local-houses-of-worship\index.html'
Add-Route '/things-to-do-near-cleveland' 'things-to-do-near-cleveland\index.html'
Add-Route '/lodging' 'lodging\index.html'
Add-Route '/restaurants' 'restaurants\index.html'
Add-Route '/2026-family-reunions' '2026-family-reunions\index.html'
Add-Route '/2026-family-reunions/app' '2026-family-reunions\app\index.html'
Add-Route '/family-reunion/harris-reunion' 'family-reunion\harris-reunion\index.html'
Add-Route '/family-reunion/millet-reunion' 'family-reunion\millet-reunion\index.html'
Add-Route '/family-reunion/millett-reunion' 'family-reunion\millett-reunion\index.html'
Add-Route '/family-reunion/2026-registration' 'family-reunion\2026-registration\index.html'

function ConvertTo-SiteUrlPath([string]$output) {
    $path = ($output -replace '\\', '/')
    if ($path -eq 'index.html') { return '' }
    return ($path -replace '/?index\.html$', '/')
}

function Get-RelativePath([string]$fromOutput, [string]$targetPath, [bool]$targetIsDirectory) {
    $fromPath = ConvertTo-SiteUrlPath $fromOutput
    $fromUri = [Uri]("https://local/" + $fromPath)

    $target = ($targetPath -replace '\\', '/')
    if ($targetIsDirectory) {
        if ($target -eq 'index.html') {
            $target = ''
        } else {
            $target = ($target -replace '/?index\.html$', '/')
        }
    }

    $targetUri = [Uri]("https://local/" + $target)
    $relative = $fromUri.MakeRelativeUri($targetUri).ToString()
    if ([string]::IsNullOrEmpty($relative)) { return './' }
    return $relative
}

function Get-LogoHref([string]$fromOutput) {
    return ((Get-RelativePath $fromOutput 'assets\VK Logo.png' $false) -replace ' ', '%20')
}

function Repair-Mojibake([string]$html) {
    $e = [char]0x00E2
    $euro = [char]0x20AC
    $badEnDash = [string]$e + [string]$euro + [string][char]0x201C
    $badEmDash = [string]$e + [string]$euro + [string][char]0x201D
    $badLeftSingle = [string]$e + [string]$euro + [string][char]0x02DC
    $badRightSingle = [string]$e + [string]$euro + [string][char]0x2122
    $badLeftDouble = [string]$e + [string]$euro + [string][char]0x0153
    $badEllipsis = [string]$e + [string]$euro + [string][char]0x00A6
    $badCopyright = [string][char]0x00C2 + [string][char]0x00A9
    $badNbsp = [string][char]0x00C2 + [string][char]0x00A0
    $badHalf = [string][char]0x00C2 + [string][char]0x00BD
    $badDegree = [string][char]0x00C2 + [string][char]0x00B0

    return $html.
        Replace($badEnDash, '&ndash;').
        Replace($badEmDash, '&mdash;').
        Replace($badLeftSingle, '&lsquo;').
        Replace($badRightSingle, '&rsquo;').
        Replace($badLeftDouble, '&ldquo;').
        Replace($badEllipsis, '&hellip;').
        Replace($badCopyright, '&copy;').
        Replace($badNbsp, ' ').
        Replace($badHalf, '&frac12;').
        Replace($badDegree, '&deg;')
}

function Get-SourceDocument($page) {
    $sourcePath = Join-Path $rootPath $page.Source
    $raw = Get-Content -LiteralPath $sourcePath -Raw
    if ($page.Type -eq 'embedded') {
        $match = [regex]::Match($raw, '&lt;!DOCTYPE html&gt;.*?&lt;/html&gt;', [Text.RegularExpressions.RegexOptions]::Singleline)
        if (-not $match.Success) {
            throw "No embedded HTML document found in $($page.Source)"
        }
        $raw = [System.Net.WebUtility]::HtmlDecode($match.Value)
    }
    return Repair-Mojibake $raw
}

function Resolve-Href([string]$href, [string]$fromOutput) {
    if ([string]::IsNullOrWhiteSpace($href)) { return $href }
    if ($href.StartsWith('#')) { return $href }
    if ($href -match '^(?i)(mailto|tel|javascript|data|sms):') { return $href }

    $working = [System.Net.WebUtility]::HtmlDecode($href)
    $fragment = ''
    $hashIndex = $working.IndexOf('#')
    if ($hashIndex -ge 0) {
        $fragment = $working.Substring($hashIndex)
        $working = $working.Substring(0, $hashIndex)
    }

    $query = ''
    $queryIndex = $working.IndexOf('?')
    if ($queryIndex -ge 0) {
        $query = $working.Substring($queryIndex)
        $working = $working.Substring(0, $queryIndex)
    }

    $path = $null
    if ($working -match '^https?://') {
        try {
            $uri = [Uri]$working
        } catch {
            return $href
        }
        if ($uri.Host -notin @('www.visitkirtland.com', 'visitkirtland.com')) {
            return $href
        }
        $path = $uri.AbsolutePath
    } elseif ($working.StartsWith('/')) {
        $path = $working
    } else {
        return $href
    }

    $normalized = if ($path -eq '/') { '/' } else { '/' + $path.Trim('/').ToLowerInvariant() }
    if ($routeMap.ContainsKey($normalized)) {
        return (Get-RelativePath $fromOutput $routeMap[$normalized] $true) + $fragment
    }

    return $href
}

function Rewrite-InternalLinks([string]$html, [string]$fromOutput) {
    return [regex]::Replace($html, 'href=(["''])(.*?)\1', {
        param($match)
        $quote = $match.Groups[1].Value
        $href = $match.Groups[2].Value
        $newHref = Resolve-Href $href $fromOutput
        return "href=$quote$newHref$quote"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Get-AssetExtension([string]$url, [string]$contentType) {
    $uri = [Uri]$url
    $extension = [IO.Path]::GetExtension($uri.AbsolutePath)
    if (-not [string]::IsNullOrWhiteSpace($extension)) {
        return $extension.ToLowerInvariant()
    }

    switch -regex ($contentType) {
        'image/png' { return '.png' }
        'image/jpeg' { return '.jpg' }
        'image/jpg' { return '.jpg' }
        'image/webp' { return '.webp' }
        'image/gif' { return '.gif' }
        'image/avif' { return '.avif' }
        'image/svg\+xml' { return '.svg' }
        default { return '.jpg' }
    }
}

function Get-OrDownloadImageAsset([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return $url }

    $decoded = [System.Net.WebUtility]::HtmlDecode($url).Trim()
    if ($decoded -notmatch '^(?i)https?://') { return $url }
    if ($script:assetDownloadCache.ContainsKey($decoded)) {
        return $script:assetDownloadCache[$decoded]
    }

    try {
        $uri = [Uri]$decoded
    } catch {
        return $url
    }

    $contentType = $null
    try {
        $head = Invoke-WebRequest -Uri $uri.AbsoluteUri -Method Head -MaximumRedirection 5 -TimeoutSec 20 -ErrorAction Stop
        if ($head.Headers['Content-Type']) {
            $contentType = [string]$head.Headers['Content-Type']
        }
    } catch {
        $contentType = $null
    }

    if ($uri.AbsolutePath -notmatch '\.(png|jpe?g|gif|webp|avif|svg)$' -and ($contentType -notmatch '^image/')) {
        return $url
    }

    $hash = [BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($decoded))
    ).Replace('-', '').ToLowerInvariant()
    $extension = Get-AssetExtension $decoded $contentType
    $assetRelative = "assets\mirrored-images\$hash$extension"
    $assetAbsolute = Join-Path $rootPath $assetRelative

    if (-not (Test-Path -LiteralPath $assetAbsolute)) {
        $assetDir = Split-Path -Parent $assetAbsolute
        New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
        Invoke-WebRequest -Uri $uri.AbsoluteUri -OutFile $assetAbsolute -MaximumRedirection 5 -TimeoutSec 60 -ErrorAction Stop | Out-Null
    }

    $script:assetDownloadCache[$decoded] = $assetRelative
    return $assetRelative
}

function Rewrite-RemoteImageUrls([string]$html, [string]$fromOutput) {
    $html = [regex]::Replace($html, '(<img\b[^>]*\bsrc=)(["''])(https?://[^"''>]+)\2', {
        param($match)
        $prefix = $match.Groups[1].Value
        $quote = $match.Groups[2].Value
        $url = $match.Groups[3].Value
        $asset = Get-OrDownloadImageAsset $url
        if ($asset -eq $url) { return $match.Value }
        $relative = Get-RelativePath $fromOutput $asset $false
        return "$prefix$quote$relative$quote"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    $html = [regex]::Replace($html, '(<source\b[^>]*\bsrc=)(["''])(https?://[^"''>]+)\2', {
        param($match)
        $prefix = $match.Groups[1].Value
        $quote = $match.Groups[2].Value
        $url = $match.Groups[3].Value
        $asset = Get-OrDownloadImageAsset $url
        if ($asset -eq $url) { return $match.Value }
        $relative = Get-RelativePath $fromOutput $asset $false
        return "$prefix$quote$relative$quote"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    $html = [regex]::Replace($html, 'style=(["''])(.*?)\1', {
        param($match)
        $quote = $match.Groups[1].Value
        $style = $match.Groups[2].Value
        $rewritten = [regex]::Replace($style, 'url\((["'']?)(https?://[^)"''>]+)\1\)', {
            param($urlMatch)
            $url = $urlMatch.Groups[2].Value
            $asset = Get-OrDownloadImageAsset $url
            if ($asset -eq $url) { return $urlMatch.Value }
            $relative = Get-RelativePath $fromOutput $asset $false
            return "url($relative)"
        }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
        return "style=$quote$rewritten$quote"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [Text.RegularExpressions.RegexOptions]::Singleline)

    $html = [regex]::Replace($html, 'url\((["'']?)(https?://[^)"''>]+)\1\)', {
        param($match)
        $url = $match.Groups[2].Value
        $asset = Get-OrDownloadImageAsset $url
        if ($asset -eq $url) { return $match.Value }
        $relative = Get-RelativePath $fromOutput $asset $false
        return "url($relative)"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    return $html
}

function Ensure-RemoteImageFile([string]$url, [string]$targetRelative) {
    $targetAbsolute = Join-Path $rootPath $targetRelative
    if (Test-Path -LiteralPath $targetAbsolute) {
        return
    }

    $targetDir = Split-Path -Parent $targetAbsolute
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Invoke-WebRequest -Uri $url -OutFile $targetAbsolute -MaximumRedirection 5 -TimeoutSec 60 -ErrorAction Stop | Out-Null
}

function New-Navigation([string]$fromOutput) {
    $homeHref = Get-RelativePath $fromOutput 'home\index.html' $true
    $rootHref = Get-RelativePath $fromOutput 'index.html' $true
    $heritage2027Href = Get-RelativePath $fromOutput 'kirtland-heritage-days\2027-kirtland-heritage-days\index.html' $true
    $historyHref = Get-RelativePath $fromOutput 'church-history-locations\index.html' $true
    $worshipHref = Get-RelativePath $fromOutput 'local-houses-of-worship\index.html' $true
    $thingsHref = Get-RelativePath $fromOutput 'things-to-do-near-cleveland\index.html' $true
    $lodgingHref = Get-RelativePath $fromOutput 'lodging\index.html' $true
    $diningHref = Get-RelativePath $fromOutput 'restaurants\index.html' $true
    $logo = Get-LogoHref $fromOutput

    return @"
<header class="site-header" data-site-header>
  <a class="site-brand" href="$rootHref" aria-label="Visit Kirtland home">
    <span class="site-brand-mark"><img src="$logo" alt=""></span>
    <span class="site-brand-text"><strong>Visit Kirtland</strong><span>The City of Faith &amp; Beauty</span></span>
  </a>
  <button class="site-nav-toggle" type="button" aria-label="Open navigation" aria-controls="site-navigation" aria-expanded="false" data-site-nav-toggle>
    <span></span><span></span><span></span>
  </button>
  <nav class="site-nav" id="site-navigation" aria-label="Primary navigation" data-site-nav>
    <a href="$homeHref" data-nav-key="home">Home</a>
    <a href="$heritage2027Href" data-nav-key="heritage">Heritage Days</a>
    <a href="$historyHref" data-nav-key="history">Church History</a>
    <a href="$worshipHref" data-nav-key="worship">Worship</a>
    <a href="$thingsHref" data-nav-key="things">Things To Do</a>
    <a href="$lodgingHref" data-nav-key="lodging">Lodging</a>
    <a href="$diningHref" data-nav-key="dining">Dining</a>
  </nav>
</header>
"@
}

Ensure-RemoteImageFile 'https://i.imgur.com/NCXUYPU.jpeg' 'assets\mirrored-images\site-hero.jpeg'

function Add-SiteChrome([string]$html, [string]$output, [string]$navKey) {
    $css = (Get-RelativePath $output 'assets\css\site.css' $false) + "?v=$assetVersion"
    $js = (Get-RelativePath $output 'assets\js\site.js' $false) + "?v=$assetVersion"
    $logo = Get-LogoHref $output
    $head = "    <link rel=`"stylesheet`" href=`"$css`">`n    <script defer src=`"$js`"></script>`n    <link rel=`"icon`" type=`"image/png`" href=`"$logo`">"
    $html = [regex]::Replace($html, '</head>', "$head`n</head>", [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    $html = [regex]::Replace($html, '<body([^>]*)>', {
        param($match)
        $attrs = $match.Groups[1].Value
        if ($attrs -match 'class=(["''])(.*?)\1') {
            $attrs = [regex]::Replace($attrs, 'class=(["''])(.*?)\1', {
                param($classMatch)
                $quote = $classMatch.Groups[1].Value
                $classes = ($classMatch.Groups[2].Value + ' site-migrated').Trim()
                return "class=$quote$classes$quote"
            }, 1)
        } else {
            $attrs = "$attrs class=`"site-migrated`""
        }
        if ($attrs -notmatch 'data-nav-key=') {
            $attrs = "$attrs data-nav-key=`"$navKey`""
        }
        return "<body$attrs>`n$(New-Navigation $output)"
    }, [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    $html = Rewrite-RemoteImageUrls $html $output

    return $html
}

function Write-OutputFile([string]$relativePath, [string]$content) {
    $target = Join-Path $sitePath $relativePath
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    [IO.File]::WriteAllText($target, $content, $utf8)
}

foreach ($page in $pages) {
    $html = Get-SourceDocument $page
    $html = Rewrite-InternalLinks $html $page.Output
    $html = Add-SiteChrome $html $page.Output $page.NavKey
    Write-OutputFile $page.Output $html
}

function New-HeritageArchivePage([string]$output) {
    $albumUrl = 'https://photos.google.com/share/AF1QipNkapuIqFEPDX31DVDTN1VQdrL9kPa6HEWOXrBe7qPDBOWIpoojzgA-xN4mP27nlg?key=cGpWQi1Cc2JhS19yNmk0R01DdWpINTJTMTVHOXdB'
    $albumHref = [System.Net.WebUtility]::HtmlEncode($albumUrl)
    $currentHref = Get-RelativePath $output 'kirtland-heritage-days\2027-kirtland-heritage-days\index.html' $true
    $homeHref = Get-RelativePath $output 'home\index.html' $true
    $baseImage = Get-RelativePath $output 'assets\mirrored-images\site-hero.jpeg' $false
    $guestBrad = Get-RelativePath $output 'assets\mirrored-images\d391c223ae9744d0b85d83c0b3da167750a7ca2a6a669aec69375119bc3e43c4.png' $false
    $guestNathan = Get-RelativePath $output 'assets\mirrored-images\203374d6ea5143cfd70c8a49e488cb81fc4a0c689cbcf24c3f7c9d8b8fcb520a.png' $false
    $guestBonner = Get-RelativePath $output 'assets\mirrored-images\879bad67b0b63b38611c22aec702017cf2ab38e215eed390fb8725bd2de9374c.jpg' $false

    $body = @"
<header class="site-page-hero" style="background:
  linear-gradient(135deg, rgba(13, 92, 76, 0.92), rgba(23, 35, 31, 0.82)),
  url('$baseImage') center/cover;">
  <div class="site-page-hero-inner">
    <p class="site-kicker">Archive</p>
    <h1>2026 Kirtland Heritage Days</h1>
    <p>June 19-21, 2026</p>
    <div class="site-action-row">
      <a class="site-button" href="$albumHref" target="_blank" rel="noopener">2026 Photo Album</a>
      <a class="site-button site-button-secondary" href="$currentHref">Go to 2027 Heritage Days</a>
    </div>
  </div>
</header>
<main class="site-app-main">
  <section style="display:grid; gap:20px;">
    <div style="display:grid; gap:12px; max-width: 980px; margin: 0 auto; text-align:center;">
      <p class="site-kicker" style="color:var(--vk-forest);">A finished celebration</p>
      <h2 style="font-family:'Playfair Display', serif; font-size:clamp(2rem, 4vw, 3rem); margin:0; color:var(--vk-ink);">The 2026 gathering is now part of the archive.</h2>
      <p style="margin:0 auto; max-width: 760px; color:var(--vk-ink); font-size:1.05rem; line-height:1.7;">Browse the photo album, revisit the speakers and guests, and use the archive as the record of the weekend.</p>
    </div>
    <div class="site-page-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
      <article class="site-card" style="overflow:hidden; border-radius:18px;">
        <img src="$guestBrad" alt="Brad Wilcox" style="width:100%; height:240px; object-fit:cover; display:block;">
        <div style="padding:18px 18px 22px;">
          <h3 style="margin:0 0 6px; font-size:1.2rem;">Brad Wilcox</h3>
          <p style="margin:0; color:rgba(23,35,31,0.72);">Featured speaker for 2026.</p>
        </div>
      </article>
      <article class="site-card" style="overflow:hidden; border-radius:18px;">
        <img src="$guestNathan" alt="Elder Nathan Johnson" style="width:100%; height:240px; object-fit:cover; display:block;">
        <div style="padding:18px 18px 22px;">
          <h3 style="margin:0 0 6px; font-size:1.2rem;">Elder Nathan Johnson</h3>
          <p style="margin:0; color:rgba(23,35,31,0.72);">Featured guest speaker.</p>
        </div>
      </article>
      <article class="site-card" style="overflow:hidden; border-radius:18px;">
        <img src="$guestBonner" alt="The Bonner Family" style="width:100%; height:240px; object-fit:cover; display:block;">
        <div style="padding:18px 18px 22px;">
          <h3 style="margin:0 0 6px; font-size:1.2rem;">The Bonner Family</h3>
          <p style="margin:0; color:rgba(23,35,31,0.72);">Music and family connection.</p>
        </div>
      </article>
    </div>
    <section style="display:grid; gap:14px; max-width: 980px; margin: 0 auto;">
      <h3 style="margin:0; font-size:1.4rem;">Archive notes</h3>
      <p style="margin:0; color:rgba(23,35,31,0.76); line-height:1.75;">Registration is closed. This page keeps the 2026 event in view for reference and directs visitors to the photo album for the finished weekend.</p>
    </section>
  </section>
</main>
"@

    return New-StandalonePage $output '2026 Kirtland Heritage Days Archive | Visit Kirtland' 'Archive page for the 2026 Kirtland Heritage Days weekend.' 'heritage' $body
}

function New-Heritage2027Page([string]$output) {
    $albumUrl = 'https://photos.google.com/share/AF1QipNkapuIqFEPDX31DVDTN1VQdrL9kPa6HEWOXrBe7qPDBOWIpoojzgA-xN4mP27nlg?key=cGpWQi1Cc2JhS19yNmk0R01DdWpINTJTMTVHOXdB'
    $albumHref = [System.Net.WebUtility]::HtmlEncode($albumUrl)
    $archive2026Href = Get-RelativePath $output 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html' $true
    $archive2025Href = Get-RelativePath $output 'kirtland-heritage-days\2025-kirtland-heritage-days\index.html' $true
    $archive2024Href = Get-RelativePath $output 'kirtland-heritage-days\2024-kirtland-heritage-days\index.html' $true
    $baseImage = Get-RelativePath $output 'assets\mirrored-images\site-hero.jpeg' $false

    $body = @"
<header class="site-page-hero" style="background:
  linear-gradient(135deg, rgba(13, 92, 76, 0.92), rgba(23, 35, 31, 0.82)),
  url('$baseImage') center/cover;">
  <div class="site-page-hero-inner">
    <p class="site-kicker">Upcoming</p>
    <h1>2027 Kirtland Heritage Days</h1>
    <p>Friday, June 18, 2027</p>
    <div class="site-action-row">
      <a class="site-button" href="$albumHref" target="_blank" rel="noopener">2026 Photo Album</a>
      <a class="site-button site-button-secondary" href="$archive2026Href">2026 Archive</a>
    </div>
    <div class="site-countdown" aria-label="Countdown to June 18, 2027">
      <div class="site-countdown-box"><span id="vk-days">--</span><small>Days</small></div>
      <div class="site-countdown-box"><span id="vk-hours">--</span><small>Hours</small></div>
      <div class="site-countdown-box"><span id="vk-minutes">--</span><small>Minutes</small></div>
      <div class="site-countdown-box"><span id="vk-seconds">--</span><small>Seconds</small></div>
    </div>
  </div>
</header>
<main class="site-app-main">
  <section style="display:grid; gap:24px;">
    <div style="max-width: 980px; margin: 0 auto; text-align:center;">
      <p class="site-kicker" style="color:var(--vk-forest);">Reunions and gathering</p>
      <h2 style="font-family:'Playfair Display', serif; font-size:clamp(2rem, 4vw, 3rem); margin:0 0 14px; color:var(--vk-ink);">Descendants of the Oliver &amp; Lydia Granger Family, W.W. and Sally Phelps Family, and more to come.</h2>
      <p style="margin:0 auto; max-width: 760px; color:var(--vk-ink); font-size:1.05rem; line-height:1.75;">The 2027 gathering is taking shape as a place for reunion, history, and connection in Kirtland.</p>
    </div>
    <div class="site-page-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
      <article class="site-card" style="padding:24px;">
        <h3 style="margin-top:0;">Families announced</h3>
        <p style="color:rgba(23,35,31,0.76); line-height:1.75;">Oliver &amp; Lydia Granger descendants. W.W. and Sally Phelps descendants. More family reunions will be added as they are confirmed.</p>
      </article>
      <article class="site-card" style="padding:24px;">
        <h3 style="margin-top:0;">Archive links</h3>
        <p style="color:rgba(23,35,31,0.76); line-height:1.75;">Review the earlier gatherings for context and planning.</p>
        <div class="site-action-row" style="justify-content:flex-start; margin-top:16px;">
          <a class="site-button" href="$archive2026Href">2026</a>
          <a class="site-button site-button-secondary" href="$archive2025Href">2025</a>
          <a class="site-button site-button-secondary" href="$archive2024Href">2024</a>
        </div>
      </article>
    </div>
  </section>
</main>
<script>
(() => {
  const target = new Date('2027-06-18T00:00:00-04:00');
  const labels = ['vk-days', 'vk-hours', 'vk-minutes', 'vk-seconds'];
  const parts = labels.map((id) => document.getElementById(id));

  function tick() {
    const delta = Math.max(0, target.getTime() - Date.now());
    const totalSeconds = Math.floor(delta / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const values = [days, hours, minutes, seconds];
    parts.forEach((node, index) => { if (node) node.textContent = String(values[index]).padStart(2, '0'); });
  }

  tick();
  setInterval(tick, 1000);
})();
</script>
"@

    return New-StandalonePage $output '2027 Kirtland Heritage Days | Visit Kirtland' 'Countdown and announcement page for the 2027 Kirtland Heritage Days gathering.' 'heritage' $body
}

function New-StandalonePage([string]$output, [string]$title, [string]$description, [string]$navKey, [string]$bodyHtml, [string]$extraHead = '') {
    $css = (Get-RelativePath $output 'assets\css\site.css' $false) + "?v=$assetVersion"
    $js = (Get-RelativePath $output 'assets\js\site.js' $false) + "?v=$assetVersion"
    $logo = Get-LogoHref $output
    $nav = New-Navigation $output
    $page = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$title</title>
  <meta name="description" content="$description">
  $extraHead
  <link rel="stylesheet" href="$css">
  <script defer src="$js"></script>
  <link rel="icon" type="image/png" href="$logo">
</head>
<body class="site-migrated site-page-body" data-nav-key="$navKey">
$nav
$bodyHtml
</body>
</html>
"@
    return (Rewrite-RemoteImageUrls $page $output)
}

Write-OutputFile 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html' (New-HeritageArchivePage 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html')
Write-OutputFile 'kirtland-heritage-days\2027-kirtland-heritage-days\index.html' (New-Heritage2027Page 'kirtland-heritage-days\2027-kirtland-heritage-days\index.html')

foreach ($homeOutput in @('index.html', 'home\index.html')) {
    $homePath = Join-Path $sitePath $homeOutput
    if (Test-Path -LiteralPath $homePath) {
        $homeHtml = Get-Content -LiteralPath $homePath -Raw
        $homeHtml = $homeHtml.Replace('../kirtland-heritage-days/2026-kirtland-heritage-days/', '../kirtland-heritage-days/2027-kirtland-heritage-days/')
        $homeHtml = $homeHtml.Replace('kirtland-heritage-days/2026-kirtland-heritage-days/', 'kirtland-heritage-days/2027-kirtland-heritage-days/')
        [IO.File]::WriteAllText($homePath, $homeHtml, $utf8)
    }
}

$appBody = @"
<header class="site-page-hero">
  <div class="site-page-hero-inner">
    <p class="site-kicker">2026 Family Reunions</p>
    <h1>Registration App</h1>
    <p>Register for the Kirtland reunion weekend, review family reunion details, and keep the event plan close at hand.</p>
    <div class="site-action-row">
      <a class="site-button" href="https://teancum1820.github.io/KirtlandReunionApp/" target="_blank" rel="noopener">Open full app</a>
      <a class="site-button site-button-secondary" href="../">Back to reunion overview</a>
    </div>
  </div>
</header>
<main class="site-app-main">
  <div class="site-embed-shell">
    <iframe src="https://teancum1820.github.io/KirtlandReunionApp/" title="Kirtland family reunion registration app" loading="lazy"></iframe>
  </div>
</main>
"@
Write-OutputFile '2026-family-reunions\app\index.html' (New-StandalonePage '2026-family-reunions\app\index.html' '2026 Family Reunion Registration | Visit Kirtland' 'Registration app for 2026 Kirtland family reunions.' 'registration' $appBody)

$appHref = Get-RelativePath 'family-reunion\2026-registration\index.html' '2026-family-reunions\app\index.html' $true
$registrationHead = "<meta http-equiv=`"refresh`" content=`"0; url=$appHref`">"
$registrationBody = @"
<header class="site-page-hero">
  <div class="site-page-hero-inner">
    <p class="site-kicker">Registration</p>
    <h1>Opening Registration</h1>
    <p>You are being sent to the 2026 family reunion registration app.</p>
    <div class="site-action-row">
      <a class="site-button" href="$appHref">Continue to registration</a>
    </div>
  </div>
</header>
<script>window.location.replace("$appHref");</script>
"@
Write-OutputFile 'family-reunion\2026-registration\index.html' (New-StandalonePage 'family-reunion\2026-registration\index.html' 'Registration | Visit Kirtland' 'Redirect to the 2026 Kirtland family reunion registration app.' 'registration' $registrationBody $registrationHead)

$homeHref = Get-RelativePath '404.html' 'index.html' $true
$notFoundBody = @"
<header class="site-page-hero">
  <div class="site-page-hero-inner">
    <p class="site-kicker">Visit Kirtland</p>
    <h1>Page Not Found</h1>
    <p>The page may have moved during the migration from Google Sites.</p>
    <div class="site-action-row">
      <a class="site-button" href="$homeHref">Return home</a>
    </div>
  </div>
</header>
"@
Write-OutputFile '404.html' (New-StandalonePage '404.html' 'Page Not Found | Visit Kirtland' 'The requested Visit Kirtland page was not found.' 'home' $notFoundBody)

$legacyRedirects = @{
    'Home.html' = 'home\index.html'
    '2026 Heritage Days.html' = 'kirtland-heritage-days\2026-kirtland-heritage-days\index.html'
    'Harris Reunion.html' = 'family-reunion\harris-reunion\index.html'
    'Millet Reunion.html' = 'family-reunion\millet-reunion\index.html'
}

foreach ($legacy in $legacyRedirects.GetEnumerator()) {
    $href = Get-RelativePath $legacy.Key $legacy.Value $true
    $body = "<script>window.location.replace(`"$href`");</script><p class=`"site-footer-note`"><a href=`"$href`">Continue</a></p>"
    Write-OutputFile $legacy.Key (New-StandalonePage $legacy.Key 'Redirecting | Visit Kirtland' 'Redirecting to the updated Visit Kirtland page.' 'home' $body "<meta http-equiv=`"refresh`" content=`"0; url=$href`">")
}

[IO.File]::WriteAllText((Join-Path $sitePath '.nojekyll'), '', $utf8)
[IO.File]::WriteAllText((Join-Path $sitePath 'CNAME'), "www.visitkirtland.com`n", $utf8)
[IO.File]::WriteAllText((Join-Path $sitePath 'robots.txt'), "User-agent: *`nAllow: /`nSitemap: https://www.visitkirtland.com/sitemap.xml`n", $utf8)

$routesForSitemap = @(
    '/', '/home/', '/kirtland-heritage-days/2026-kirtland-heritage-days/',
    '/kirtland-heritage-days/2025-kirtland-heritage-days/',
    '/kirtland-heritage-days/2024-kirtland-heritage-days/',
    '/church-history-locations/', '/local-houses-of-worship/',
    '/things-to-do-near-cleveland/', '/lodging/', '/restaurants/',
    '/2026-family-reunions/', '/2026-family-reunions/app/',
    '/family-reunion/harris-reunion/', '/family-reunion/millet-reunion/'
)
$sitemapItems = $routesForSitemap | ForEach-Object { "  <url><loc>https://www.visitkirtland.com$_</loc></url>" }
$sitemap = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n$($sitemapItems -join "`n")`n</urlset>`n"
[IO.File]::WriteAllText((Join-Path $sitePath 'sitemap.xml'), $sitemap, $utf8)

Write-Output "Built Visit Kirtland site at $sitePath"
