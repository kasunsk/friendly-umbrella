# Construction Pricing Platform - Startup Script
# This script starts all required services: Docker, Database, Backend, and Frontend

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Construction Pricing Platform" -ForegroundColor Cyan
Write-Host "  Starting Application..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Step 1: Check if Docker is running
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "  ✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Docker is NOT running!" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Step 2: Start Docker containers
Write-Host "`n[2/6] Starting Docker containers (PostgreSQL & Redis)..." -ForegroundColor Yellow
docker-compose up -d

# Wait for containers to be healthy
Write-Host "  Waiting for containers to be healthy..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$postgresReady = $false
$redisReady = $false

while ($attempt -lt $maxAttempts -and (-not $postgresReady -or -not $redisReady)) {
    Start-Sleep -Seconds 2
    $attempt++
    
    try {
        $postgresHealth = docker inspect construction-pricing-db --format='{{.State.Health.Status}}' 2>$null
        $redisHealth = docker inspect construction-pricing-redis --format='{{.State.Health.Status}}' 2>$null
        
        if ($postgresHealth -eq "healthy") {
            $postgresReady = $true
        }
        if ($redisHealth -eq "healthy") {
            $redisReady = $true
        }
        
        if ($attempt % 5 -eq 0) {
            Write-Host "  Still waiting... ($attempt/$maxAttempts)" -ForegroundColor Gray
        }
    } catch {
        # Continue waiting
    }
}

if ($postgresReady -and $redisReady) {
    Write-Host "  ✅ Docker containers are healthy" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Containers may still be starting, but continuing..." -ForegroundColor Yellow
}

# Step 3: Generate Prisma Client
Write-Host "`n[3/6] Generating Prisma Client..." -ForegroundColor Yellow
Set-Location packages\backend
npm run db:generate | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Prisma Client generated" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Prisma Client generation may have issues" -ForegroundColor Yellow
}

# Step 4: Run database migrations
Write-Host "`n[4/6] Running database migrations..." -ForegroundColor Yellow
npm run db:migrate 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Database migrations completed" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Migration may have issues, but continuing..." -ForegroundColor Yellow
}

Set-Location ..\..

# Step 5: Start Backend Server
Write-Host "`n[5/6] Starting Backend Server..." -ForegroundColor Yellow
Write-Host "  Starting in background... (Port 8000)" -ForegroundColor Gray

$backendScript = @"
cd packages\backend
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Minimized

# Wait for backend to start
Write-Host "  Waiting for backend to start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

$backendReady = $false
$backendAttempts = 0
while ($backendAttempts -lt 15 -and -not $backendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
        }
    } catch {
        Start-Sleep -Seconds 2
        $backendAttempts++
    }
}

if ($backendReady) {
    Write-Host "  ✅ Backend is running on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Backend may still be starting..." -ForegroundColor Yellow
}

# Step 6: Start Frontend Server
Write-Host "`n[6/6] Starting Frontend Server..." -ForegroundColor Yellow
Write-Host "  Starting in background... (Port 3000)" -ForegroundColor Gray

$frontendScript = @"
cd packages\frontend
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Minimized

# Wait for frontend to start
Write-Host "  Waiting for frontend to start (this may take 30-60 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 10

$frontendReady = $false
$frontendAttempts = 0
while ($frontendAttempts -lt 20 -and -not $frontendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
        }
    } catch {
        Start-Sleep -Seconds 3
        $frontendAttempts++
    }
}

if ($frontendReady) {
    Write-Host "  ✅ Frontend is running on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Frontend may still be compiling (check the frontend window)" -ForegroundColor Yellow
}

# Final Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ Application Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐 Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  🔧 Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  💚 Health:   http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "  📊 Database: PostgreSQL (port 5432)" -ForegroundColor White
Write-Host "  📦 Cache:    Redis (port 6379)" -ForegroundColor White
Write-Host ""
Write-Host "  📝 Note: Backend and Frontend are running in separate windows." -ForegroundColor Gray
Write-Host "          You can view their logs in those windows." -ForegroundColor Gray
Write-Host ""
Write-Host "========================================`n" -ForegroundColor Cyan









