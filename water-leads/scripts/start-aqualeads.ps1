# Start AquaLeads from the project root (local daily driver).
# Usage:  .\scripts\start-aqualeads.ps1
# First-time:  python -m venv .venv
#                .\.venv\Scripts\pip install -r requirements.txt
#                copy .env.example .env
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$py = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "No .venv found. Create one in $Root :" -ForegroundColor Yellow
    Write-Host "  python -m venv .venv" -ForegroundColor Cyan
    Write-Host "  .\.venv\Scripts\pip install -r requirements.txt" -ForegroundColor Cyan
    exit 1
}
# load_dotenv() is inside main.py; env vars must be in .env
& $py (Join-Path $Root "main.py")
