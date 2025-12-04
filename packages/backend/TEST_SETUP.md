# Integration Test Suite Setup Guide

This guide will help you set up and run the comprehensive integration test suite for the backend.

## Quick Start

### 1. Install Dependencies

```bash
cd packages/backend
npm install
```

The test suite uses:
- **Jest** - Test framework
- **Supertest** - HTTP assertions
- **ts-jest** - TypeScript support

### 2. Set Up Test Database

Create a separate test database:

```sql
CREATE DATABASE construction_pricing_test;
```

### 3. Configure Test Environment

Set the `TEST_DATABASE_URL` environment variable:

**Linux/Mac:**
```bash
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public
```

**Windows PowerShell:**
```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public"
```

**Or create `.env.test` file:**
```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public
```

### 4. Run Migrations

Apply database migrations to the test database:

```bash
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
```

Or on Windows:
```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL; npx prisma migrate deploy
```

### 5. Run Tests

```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The integration test suite covers:

### ✅ Authentication Routes
- User registration (supplier, company)
- User login (super admin, tenant admin)
- Get current user
- Get active tenants

### ✅ Product Routes
- Create, read, update, delete products
- List products with pagination
- Get supplier statistics
- Product search

### ✅ Price Routes
- Update default prices
- Create/update private prices
- Price search for companies
- Discount percentage handling

### ✅ Super Admin Routes
- Tenant approval/rejection
- Get all tenants (filtered)
- Create super admins
- Toggle tenant status
- System statistics

### ✅ Tenant Admin Routes
- User management (create, approve, reject)
- Get tenant users (filtered)
- Tenant statistics

## Test Structure

```
src/__tests__/
├── setup/                    # Test infrastructure
│   ├── testSetup.ts         # Database setup/teardown
│   ├── appSetup.ts          # Express app for testing
│   ├── globalSetup.ts       # Global configuration
│   └── jest.setup.ts        # Jest setup file
├── helpers/                  # Test utilities
│   ├── authHelpers.ts      # Authentication helpers
│   └── testHelpers.ts      # General utilities
└── integration/             # Integration tests
    ├── auth.integration.test.ts
    ├── products.integration.test.ts
    ├── prices.integration.test.ts
    ├── superAdmin.integration.test.ts
    └── tenantAdmin.integration.test.ts
```

## Writing Tests

See `src/__tests__/README.md` for detailed documentation on:
- Test structure
- Helper functions
- Best practices
- Troubleshooting

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: construction_pricing_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public
        run: |
          cd packages/backend
          npx prisma migrate deploy
      
      - name: Run integration tests
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/construction_pricing_test?schema=public
          JWT_SECRET: test-jwt-secret
          JWT_REFRESH_SECRET: test-refresh-secret
        run: |
          cd packages/backend
          npm run test:integration
```

## Troubleshooting

### Database Connection Errors
- Verify `TEST_DATABASE_URL` is set correctly
- Check database is running
- Ensure database exists

### Migration Errors
- Run migrations manually: `npx prisma migrate deploy`
- Check schema.prisma is up to date

### Test Timeouts
- Increase timeout in `jest.config.js`
- Check database connection speed
- Verify no long-running operations

### Port Conflicts
- Tests don't start a server (use supertest)
- No port conflicts expected

## Next Steps

1. ✅ Set up test database
2. ✅ Configure environment variables
3. ✅ Run migrations
4. ✅ Run tests: `npm test`
5. ✅ Review coverage: `npm run test:coverage`

For detailed test documentation, see `src/__tests__/README.md`.


