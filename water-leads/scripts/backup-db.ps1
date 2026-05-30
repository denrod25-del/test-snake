# Copy the SQLite database to ./backups with a date stamp.
# Usage: .\scripts\backup-db.ps1
# Set DATABASE_PATH in .env if your DB is not the default.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*DATABASE_PATH\s*=\s*(.+)$") {
            $script:DB = $matches[1].Trim()
        }
    }
}
if (-not $DB) { $DB = "water-leads.db" }
$src = Join-Path $Root $DB
if (-not (Test-Path $src)) {
    Write-Host "Database not found: $src" -ForegroundColor Red
    exit 1
}
$destDir = Join-Path $Root "backups"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = [IO.Path]::GetFileNameWithoutExtension($DB) + "-$stamp" + [IO.Path]::GetExtension($DB)
Copy-Item $src (Join-Path $destDir $name)
Write-Host "Backed up to backups\$name" -ForegroundColor Green
