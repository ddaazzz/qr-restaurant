#!/usr/bin/env pwsh
Set-Location -Path "c:\Users\DT\Documents\qr-restaurant-ai\backend"
Write-Host "Starting backend server from: $(Get-Location)" -ForegroundColor Green
npm run dev 2>&1
