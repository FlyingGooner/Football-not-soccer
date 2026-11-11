<#
.SYNOPSIS
  Builds a single self-contained HTML file for testing: dist/<project>.html

.DESCRIPTION
  Reads index.html in the project root and inlines everything it loads:
    - <link rel="stylesheet">          -> <style>
    - <script src>                     -> inline <script>
    - <script type="module" src>       -> inline <script>; ES modules are bundled
                                          (named imports/exports, each module in its own scope)
    - <link rel="icon"/"apple-touch-icon"> -> data: URI
    - <img src> (local, also inside <template>) -> data: URI
  Drops the manifest link (PWA install and service workers do not work over file://).
  Loosens the CSP only in the generated file so inline code may run; the app's own CSP is untouched.

  The PWA in the project root is never modified. dist/ is git-ignored.
  Same script in every project (keep the copies identical).

.EXAMPLE
  .\tools\build-single.ps1
#>
param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path.TrimEnd('\')
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$rel) { [IO.File]::ReadAllText((Join-Path $Root $rel), $utf8) }
function Get-Attr([string]$tag, [string]$name) {
  $m = [regex]::Match($tag, "(?i)\b$name\s*=\s*[""']([^""']*)[""']")
  if ($m.Success) { $m.Groups[1].Value } else { $null }
}
function Test-Local([string]$url) { $url -and $url -notmatch '^(?i)([a-z]+:|//)' }
function Clean-Path([string]$url) { ($url -split '[?#]')[0] -replace '^\./', '' }
# Keeps inlined code from closing its own <script>/<style> tag.
function Protect([string]$code, [string]$tag) { [regex]::Replace($code, "(?i)</($tag)", '<\/$1') }

function To-DataUri([string]$rel) {
  $path = Join-Path $Root (Clean-Path $rel)
  $mime = @{ '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.jpg' = 'image/jpeg'; '.webp' = 'image/webp' }[[IO.Path]::GetExtension($path).ToLower()]
  if (-not $mime) { throw "Unknown image type: $rel" }
  "data:$mime;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
}

# ---------- ES module bundling ----------
$script:modules = [ordered]@{}                      # rel path -> scope variable name
$script:moduleOut = New-Object System.Collections.Generic.List[string]
$importRe = '(?ms)^[ \t]*import\s+(?:(\{[^}]*\})|\*\s+as\s+([\w$]+))\s+from\s+[''"]([^''"]+)[''"][ \t]*;?'
$sideRe = '(?m)^[ \t]*import\s+[''"]([^''"]+)[''"][ \t]*;?'

function Resolve-Spec([string]$fromRel, [string]$spec) {
  if ($spec -notmatch '^\.{1,2}/') { throw "Only relative imports are supported: '$spec' in $fromRel" }
  $dir = Split-Path (Join-Path $Root $fromRel) -Parent
  $full = [IO.Path]::GetFullPath((Join-Path $dir $spec))
  $full.Substring($Root.Length + 1) -replace '\\', '/'
}

# Rewrites imports to read from earlier module scopes. Returns the code; dependencies are emitted first.
function Convert-Imports([string]$rel, [string]$code) {
  $code = [regex]::Replace($code, $importRe, [Text.RegularExpressions.MatchEvaluator] {
      param($m)
      $dep = Add-Module (Resolve-Spec $rel $m.Groups[3].Value)
      if ($m.Groups[1].Success) {
        $names = $m.Groups[1].Value -replace '([\w$]+)\s+as\s+([\w$]+)', '$1: $2'
        "const $names = $dep;"
      } else { "const $($m.Groups[2].Value) = $dep;" }
    })
  [regex]::Replace($code, $sideRe, [Text.RegularExpressions.MatchEvaluator] {
      param($m) $null = Add-Module (Resolve-Spec $rel $m.Groups[1].Value); ''
    })
}

function Add-Module([string]$rel) {
  if ($script:modules.Contains($rel)) { return $script:modules[$rel] }
  $name = '__mod_' + ($rel -replace '[^A-Za-z0-9]', '_')
  $script:modules[$rel] = $name
  $code = Convert-Imports $rel (Read-Text $rel)
  if ($code -match '(?m)^\s*export\s+default\b') { throw "export default is not supported ($rel)" }
  $exports = New-Object System.Collections.Generic.List[string]
  foreach ($m in [regex]::Matches($code, '(?m)^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)')) { $exports.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($code, '(?m)^export\s*\{([^}]*)\}')) {
    foreach ($part in $m.Groups[1].Value -split ',') {
      $p = $part.Trim(); if (-not $p) { continue }
      if ($p -match '^([\w$]+)\s+as\s+([\w$]+)$') { $exports.Add("$($Matches[2]): $($Matches[1])") } else { $exports.Add($p) }
    }
  }
  $code = $code -replace '(?m)^export\s*\{[^}]*\}\s*;?', '' -replace '(?m)^export\s+', ''
  $script:moduleOut.Add("// ---- $rel ----`nconst $name = (() => {`n'use strict';`n$code`nreturn { $($exports -join ', ') };`n})();")
  $name
}

function Bundle-Entry([string]$rel) {
  $script:modules = [ordered]@{}
  $script:moduleOut.Clear()
  $script:modules[$rel] = '__entry'
  $code = Convert-Imports $rel (Read-Text $rel)
  (@($script:moduleOut) + "// ---- $rel ----`n(() => {`n'use strict';`n$code`n})();") -join "`n`n"
}

# ---------- CSP ----------
function Patch-Csp([string]$csp) {
  $d = [ordered]@{}
  foreach ($part in $csp -split ';') {
    $t = $part.Trim(); if (-not $t) { continue }
    $n, $v = $t -split '\s+', 2
    $d[$n.ToLower()] = "$v".Trim()
  }
  $def = $d['default-src']
  $add = @{ 'script-src' = "'unsafe-inline'"; 'style-src' = "'unsafe-inline'"; 'img-src' = 'data:' }
  foreach ($k in $add.Keys) {
    $v = if ($d.Contains($k)) { $d[$k] } else { "$def" }
    if ($v -eq "'none'") { $v = '' }
    if ($v -notmatch [regex]::Escape($add[$k])) { $v = "$v $($add[$k])".Trim() }
    $d[$k] = $v
  }
  $d.Remove('manifest-src'); $d.Remove('worker-src')
  ($d.Keys | ForEach-Object { "$_ $($d[$_])".Trim() }) -join '; '
}

# ---------- Build ----------
$project = Split-Path $Root -Leaf
$version = '?'
if (Test-Path (Join-Path $Root 'version.js')) {
  $vm = [regex]::Match((Read-Text 'version.js'), 'APP_VERSION\s*=\s*[''"]([^''"]+)')
  if ($vm.Success) { $version = $vm.Groups[1].Value }
}

$html = Read-Text 'index.html'

$html = [regex]::Replace($html, '(?i)(<meta\s+http-equiv=["'']Content-Security-Policy["'']\s+content=")([^"]*)(")', [Text.RegularExpressions.MatchEvaluator] {
    param($m) $m.Groups[1].Value + (Patch-Csp $m.Groups[2].Value) + $m.Groups[3].Value
  })

$html = [regex]::Replace($html, '(?i)[ \t]*<link\b[^>]*>\r?\n?', [Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $tag = $m.Value; $rel = "$(Get-Attr $tag 'rel')".ToLower(); $href = Get-Attr $tag 'href'
    $indent = [regex]::Match($tag, '^[ \t]*').Value
    if ($rel -eq 'manifest') { return '' }
    if (-not (Test-Local $href)) { return $tag }
    if ($rel -eq 'stylesheet') { return "$indent<style>`n$(Protect (Read-Text (Clean-Path $href)) 'style')`n$indent</style>`n" }
    if ($rel -match '\bicon\b') { return $tag.Replace($href, (To-DataUri $href)) }
    $tag
  })

# Local <img src> (e.g. pictures in the in-app manual) -> data: URI, also inside <template>.
$html = [regex]::Replace($html, '(?i)<img\b[^>]*>', [Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $src = Get-Attr $m.Value 'src'
    if (-not (Test-Local $src)) { return $m.Value }
    $m.Value.Replace($src, (To-DataUri $src))
  })

$html = [regex]::Replace($html, '(?is)<script\b([^>]*)>\s*</script>', [Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $src = Get-Attr $m.Value 'src'
    if (-not (Test-Local $src)) { return $m.Value }
    $file = Clean-Path $src
    $code = if ((Get-Attr $m.Value 'type') -eq 'module') { Bundle-Entry $file } else { Read-Text $file }
    "<script>`n// ---- $file ----`n$(Protect $code 'script')`n</script>"
  })

$banner = "<!-- Test build of $project v$version. Generated by tools/build-single.ps1 - do not edit; change the source files and rebuild. -->"
$html = [regex]::Replace($html, '(?i)^(<!doctype html>)', "`$1`n$banner")

$dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$out = Join-Path $dist "$project.html"
[IO.File]::WriteAllText($out, $html, $utf8)
"Built $out ($([math]::Round((Get-Item $out).Length / 1KB)) KB, v$version)"
