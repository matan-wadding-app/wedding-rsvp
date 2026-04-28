param(
  [ValidateSet("production", "local")]
  [string]$Mode = "production",

  [string]$BaseUrl = "https://matan-wadding-app.github.io/wedding-rsvp",
  [switch]$CopyLinks,

  [switch]$OpenPublishPanels,
  [switch]$OpenSupabasePanels,
  [switch]$OpenSqlFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Open-Url {
  param([string]$Url)
  Write-Host "Opening: $Url"
  $chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )

  $chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chromeExe) {
    Start-Process -FilePath $chromeExe -ArgumentList $Url | Out-Null
  } else {
    Write-Warning "Chrome not found. Opening with default browser."
    Start-Process $Url | Out-Null
  }
}

function Resolve-LocalBaseUrl {
  $port = 5500
  $isRunning = $false

  try {
    $test = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 2
    if ($test.StatusCode -ge 200) { $isRunning = $true }
  } catch {}

  if (-not $isRunning) {
    Write-Host "Starting local static server on port $port..."
    if (Get-Command python -ErrorAction SilentlyContinue) {
      Start-Process python -ArgumentList "-m http.server $port" -WorkingDirectory $PSScriptRoot | Out-Null
      Start-Sleep -Seconds 2
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
      Start-Process py -ArgumentList "-m http.server $port" -WorkingDirectory $PSScriptRoot | Out-Null
      Start-Sleep -Seconds 2
    } else {
      throw "Python was not found. Install Python or run in production mode."
    }
  }

  return "http://localhost:$port"
}

if ($Mode -eq "local") {
  $BaseUrl = Resolve-LocalBaseUrl
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$guestUrl = "$BaseUrl/"
$adminUrl = "$BaseUrl/MPadmin.html"

Write-Host "Mode: $Mode"
Write-Host "Base URL: $BaseUrl"

# Open guest + admin together
Open-Url -Url $guestUrl
Open-Url -Url $adminUrl

Write-Host ""
Write-Host "Send-ready URLs:"
Write-Host "Guest page: $guestUrl"
Write-Host "Admin page: $adminUrl"

if ($CopyLinks) {
  $linksBlock = @"
Guest page:
$guestUrl

Admin page:
$adminUrl
"@
  Set-Clipboard -Value $linksBlock
  Write-Host "Copied guest/admin links to clipboard."
}

if ($OpenPublishPanels) {
  Open-Url -Url "https://github.com/matan-wadding-app/wedding-rsvp"
  Open-Url -Url "https://github.com/matan-wadding-app/wedding-rsvp/settings/pages"
}

if ($OpenSupabasePanels) {
  Open-Url -Url "https://supabase.com/dashboard"
}

if ($OpenSqlFile) {
  $sqlPath = Join-Path $PSScriptRoot "supabase\rls-policies.sql"
  if (Test-Path $sqlPath) {
    Write-Host "Opening SQL policy file: $sqlPath"
    Start-Process $sqlPath | Out-Null
  } else {
    Write-Warning "SQL file not found: $sqlPath"
  }
}

Write-Host ""
Write-Host "Done. Opened guest + admin URLs."
