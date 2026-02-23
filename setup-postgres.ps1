# PostgreSQL Setup Helper for Windows
# This script helps identify PostgreSQL installation and provides setup guidance

Write-Host "🔍 PostgreSQL Setup Helper" -ForegroundColor Green
Write-Host "=" * 50

# Check if PostgreSQL is installed
Write-Host "`n📦 Checking PostgreSQL installation..."

$pgPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe",
    "C:\Program Files (x86)\PostgreSQL\*\bin\pg_ctl.exe"
)

$pgFound = $false
foreach ($path in $pgPaths) {
    if (Test-Path $path) {
        Write-Host "✅ Found PostgreSQL at: $path" -ForegroundColor Green
        $pgFound = $true
        break
    }
}

if (-not $pgFound) {
    Write-Host "❌ PostgreSQL not found in standard locations" -ForegroundColor Red
    Write-Host "`n⚠️  Please install PostgreSQL:"
    Write-Host "   1. Download from: https://www.postgresql.org/download/windows/"
    Write-Host "   2. Run installer with default settings"
    Write-Host "   3. Note the password for 'postgres' user"
    Write-Host "   4. Run this script again after installation`n"
    exit 1
}

# Check if postgres service is running
Write-Host "`n📊 Checking PostgreSQL service status..."
$pgService = Get-Service | Where-Object { $_.Name -like "*PostgreSQL*" }

if ($pgService) {
    Write-Host "✅ PostgreSQL Service Found: $($pgService.Name)" -ForegroundColor Green
    if ($pgService.Status -eq "Running") {
        Write-Host "✅ Service is RUNNING" -ForegroundColor Green
    } else {
        Write-Host "❌ Service is STOPPED" -ForegroundColor Red
        Write-Host "   Starting service..." -ForegroundColor Yellow
        Start-Service $pgService.Name
        Start-Sleep -Seconds 3
        Write-Host "✅ Service started" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  PostgreSQL service not found" -ForegroundColor Yellow
    Write-Host "   You may need to start PostgreSQL manually via pgAdmin or Services app"
}

# Try to connect
Write-Host "`n🔗 Testing PostgreSQL connection..."
try {
    # Use psql if available
    $psqlPath = "psql"
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $result = & psql -U postgres -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Connection successful!" -ForegroundColor Green
            Write-Host $result[0]
        } else {
            Write-Host "⚠️  Connection failed. Check password in .env file" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  psql not in PATH. Add PostgreSQL bin folder to PATH:" -ForegroundColor Yellow
        Write-Host '   $env:Path += ";C:\Program Files\PostgreSQL\17\bin"' -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Error testing connection: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n"
Write-Host "=" * 50
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "1. Ensure PostgreSQL service is running (check above)" -ForegroundColor Cyan
Write-Host "2. Create database: psql -U postgres -c 'CREATE DATABASE qrrestaurant;'" -ForegroundColor Cyan
Write-Host "3. Load schema: psql -U postgres -d qrrestaurant -f qrrestaurant.sql" -ForegroundColor Cyan
Write-Host "4. Start backend: npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed setup instructions, see DATABASE_SETUP.md" -ForegroundColor Gray
