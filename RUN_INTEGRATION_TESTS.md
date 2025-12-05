# How to Run Integration Tests Locally

## Prerequisites

1. **Docker Desktop must be running**
   - Start Docker Desktop application
   - Wait until it shows "Docker Desktop is running" (green icon)

2. **Database Setup**
   - Start PostgreSQL container
   - Create test database
   - Set environment variables

## Step-by-Step Instructions

### Step 1: Start Docker Desktop
- Open Docker Desktop application on Windows
- Wait for it to fully start (green icon in system tray)

### Step 2: Start Database Containers

```powershell
# Navigate to project root
cd C:\Users\kasun\OneDrive\Desktop\Projects\friendly-umbrella

# Start Docker containers
docker-compose up -d

# Wait 10-15 seconds, then verify
docker ps
```

You should see:
- `construction-pricing-db` (PostgreSQL)
- `construction-pricing-redis` (Redis)

### Step 3: Create Test Database

```powershell
# Connect to PostgreSQL and create test database
docker exec -it construction-pricing-db psql -U postgres -c "CREATE DATABASE construction_pricing_test;"
```

### Step 4: Set Test Database URL

For PowerShell (temporary session):
```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public"
```

Or create `.env.test` file in `packages/backend/`:
```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public
```

### Step 5: Setup Test Database Schema

```powershell
cd packages/backend
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npx prisma db push --skip-generate --accept-data-loss
cd ..\..
```

### Step 6: Run Integration Tests

```powershell
cd packages/backend
npm run test:integration
```

## Quick Script (PowerShell)

```powershell
# 1. Start Docker containers
docker-compose up -d

# Wait a bit
Start-Sleep -Seconds 15

# 2. Create test database
docker exec construction-pricing-db psql -U postgres -c "CREATE DATABASE construction_pricing_test;" 2>$null

# 3. Set environment variable
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public"

# 4. Setup schema
cd packages/backend
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npx prisma db push --skip-generate --accept-data-loss
cd ..\..

# 5. Run tests
cd packages/backend
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public"
npm run test:integration
```

## Troubleshooting

### Docker daemon not running
- Start Docker Desktop manually
- Check: `docker ps` should work without errors

### Database connection errors
- Verify containers are running: `docker ps`
- Check if PostgreSQL is accessible: `docker exec construction-pricing-db pg_isready -U postgres`

### Test database already exists
- The create command will show an error, but that's OK - it means it already exists

