# Backend Integration Test Suite

This directory contains comprehensive integration tests for the backend API. The tests cover all routes and functionality of the Construction Pricing Platform.

## Test Structure

```
__tests__/
├── setup/                  # Test setup utilities
│   ├── testSetup.ts       # Database setup and teardown
│   ├── appSetup.ts        # Express app setup for testing
│   └── globalSetup.ts     # Global test configuration
├── helpers/               # Test helper functions
│   ├── authHelpers.ts    # Authentication test utilities
│   └── testHelpers.ts    # General test utilities
└── integration/          # Integration test files
    ├── auth.integration.test.ts
    ├── products.integration.test.ts
    ├── prices.integration.test.ts
    ├── superAdmin.integration.test.ts
    └── tenantAdmin.integration.test.ts
```

## Prerequisites

1. **Test Database**: You need a separate test database. Set the `TEST_DATABASE_URL` environment variable:
   ```bash
   TEST_DATABASE_URL=postgresql://user:password@localhost:5432/construction_pricing_test?schema=public
   ```

2. **Dependencies**: All required dependencies are included in `package.json`:
   - `jest` - Test framework
   - `supertest` - HTTP assertions for Express
   - `ts-jest` - TypeScript support for Jest

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- auth.integration.test.ts
```

## Test Coverage

### Auth Routes (`auth.integration.test.ts`)
- ✅ User registration (new supplier, new company)
- ✅ User login (super admin, tenant admin)
- ✅ Get current user (`/auth/me`)
- ✅ Get active tenants for registration
- ✅ Error handling (invalid credentials, duplicate email, etc.)

### Product Routes (`products.integration.test.ts`)
- ✅ Create product (supplier only)
- ✅ List products with pagination
- ✅ Get product by ID
- ✅ Update product
- ✅ Delete product
- ✅ Get supplier statistics
- ✅ Filtering and search

### Price Routes (`prices.integration.test.ts`)
- ✅ Update default price
- ✅ Create private price (with price or discount)
- ✅ Update private price
- ✅ Search products with prices (company)
- ✅ Get product price (company)
- ✅ Price validation and error handling

### Super Admin Routes (`superAdmin.integration.test.ts`)
- ✅ Get pending tenants
- ✅ Get all tenants (with filters)
- ✅ Approve/reject tenants
- ✅ Create super admin
- ✅ Get all super admins
- ✅ Toggle tenant status
- ✅ Get system statistics

### Tenant Admin Routes (`tenantAdmin.integration.test.ts`)
- ✅ Get pending users
- ✅ Get all users in tenant (with filters)
- ✅ Create new user (pending)
- ✅ Approve/reject users
- ✅ Get tenant statistics

## Test Utilities

### Authentication Helpers

```typescript
import { createTestSuperAdmin, createTestTenantAdmin } from '../helpers/authHelpers';

// Create a super admin user
const superAdmin = await createTestSuperAdmin(prisma, 'admin@test.com', 'password123');

// Create a tenant admin
const tenantAdmin = await createTestTenantAdmin(prisma, tenantId, {
  email: 'admin@tenant.com',
  password: 'password123',
});
```

### Test Helpers

```typescript
import { randomEmail, getErrorMessage } from '../helpers/testHelpers';

// Generate random email
const email = randomEmail();

// Extract error message from API response
const errorMsg = getErrorMessage(response);
```

## Test Database Setup

Tests use a separate test database to avoid affecting development data. The test database is:

1. **Cleaned before each test file** - All tables are truncated
2. **Isolated** - Tests don't affect each other
3. **Fast** - Uses in-memory or dedicated test database

### Setting Up Test Database

1. Create a test database:
   ```sql
   CREATE DATABASE construction_pricing_test;
   ```

2. Set environment variable:
   ```bash
   export TEST_DATABASE_URL=postgresql://user:password@localhost:5432/construction_pricing_test?schema=public
   ```

   Or create a `.env.test` file:
   ```
   TEST_DATABASE_URL=postgresql://user:password@localhost:5432/construction_pricing_test?schema=public
   ```

3. Run migrations on test database:
   ```bash
   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
   ```

## Writing New Tests

### Test Structure

```typescript
describe('Route Name', () => {
  let app: Express;
  let prisma: PrismaClient;
  
  beforeAll(async () => {
    // Setup database and app
    await setupTestDatabase();
    prisma = getTestPrisma();
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clean database and create test data
    await cleanTestDatabase();
    // Create test fixtures
  });

  afterAll(async () => {
    // Cleanup
    await closeTestDatabase();
  });

  describe('POST /api/v1/route', () => {
    it('should do something', async () => {
      const response = await request(app)
        .post('/api/v1/route')
        .set('Authorization', `Bearer ${token}`)
        .send({ /* data */ });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean database between tests
3. **Fixtures**: Use helper functions to create test data
4. **Assertions**: Test both success and error cases
5. **Authentication**: Test with and without authentication
6. **Authorization**: Test role-based access control

## Troubleshooting

### Tests Fail with Database Connection Error
- Check `TEST_DATABASE_URL` is set correctly
- Verify database exists and is accessible
- Run migrations: `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy`

### Tests Fail with "Table does not exist"
- Run Prisma migrations on test database
- Check schema.prisma is up to date

### Tests are Slow
- Use a dedicated test database (not shared with dev)
- Consider using SQLite for faster tests (modify testSetup.ts)

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  run: |
    npm run test:integration
```

## Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%

Run `npm run test:coverage` to see current coverage.


