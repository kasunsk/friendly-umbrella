# E2E Test Login Issue - Analysis

## 🔴 Problem Summary

All E2E tests are failing with a **401 Unauthorized** error when trying to log in. The error occurs in the authentication fixtures when attempting to log in with test user credentials.

## 📋 Error Details

```
Error: Login failed: 401 Unauthorized
Location: e2e/fixtures/auth.fixtures.ts:23
Fixture: supplierAdminPage (and other authenticated fixtures)
```

## 🔍 Root Cause Analysis

### 1. **What's Happening**

The E2E test fixtures (`e2e/fixtures/auth.fixtures.ts`) are trying to log in with pre-defined test user credentials:

- **Super Admin**: `admin@system.com` / `admin123`
- **Supplier Admin**: `supplier@example.com` / `password123`
- **Company Admin**: `company@example.com` / `password123`

These users attempt to log in via API at `http://localhost:8000/api/v1/auth/login`, but the backend returns `401 Unauthorized`.

### 2. **Why It's Failing**

The `401 Unauthorized` error from the backend (`packages/backend/src/services/authService.ts:202`) means one of:

1. **User doesn't exist** - The email is not found in the database
2. **Password is incorrect** - The password doesn't match the stored hash
3. **User exists but is inactive/pending** - User status prevents login

Most likely cause: **The test users don't exist in the database** because:
- The database hasn't been seeded with test users
- The E2E test setup doesn't automatically seed the database
- The backend server is connecting to an empty/unseeded database

### 3. **Expected Test Users**

According to the seed script (`packages/backend/prisma/seed.ts`), these users should exist:

```typescript
// Super Admin
email: 'admin@system.com'
password: 'admin123' (hashed with bcrypt)

// Supplier Admin  
email: 'supplier@example.com'
password: 'password123' (hashed with bcrypt)
tenant: 'ABC Materials Supplier' (active)

// Company Admin
email: 'company@example.com'
password: 'password123' (hashed with bcrypt)
tenant: 'XYZ Construction Company' (active)
```

### 4. **Current E2E Test Flow**

```
1. Playwright starts backend server (via webServer config)
2. Backend server connects to database (from DATABASE_URL env var)
3. Playwright fixtures try to log in with test credentials
4. Backend returns 401 because users don't exist
5. All tests fail
```

**Problem**: There's no step to seed the database with test users before tests run!

### 5. **How Integration Tests Handle This**

Integration tests have a different approach:
- They create test users on-the-fly in `beforeEach` hooks
- They use helper functions like `createTestTenantWithAdmin()` to create users
- They clean up after each test

But E2E tests use **pre-existing users** from the seed script, which may not exist.

## 🎯 Possible Solutions

### Solution 1: Auto-Seed Database Before E2E Tests (Recommended)

Add a global setup hook that seeds the database before E2E tests run:

**Pros:**
- ✅ Matches expected behavior (users from seed script)
- ✅ Consistent with documentation
- ✅ Tests real seed data

**Cons:**
- Requires database to be accessible during test setup
- Need to handle cleanup

### Solution 2: Create Test Users On-The-Fly

Modify E2E fixtures to create users before logging in (similar to integration tests):

**Pros:**
- ✅ No dependency on seed script
- ✅ Tests are self-contained
- ✅ More reliable

**Cons:**
- Different from expected test flow
- Requires more setup code

### Solution 3: Use a Separate E2E Test Database with Seeding

Create a dedicated E2E test database that gets seeded automatically:

**Pros:**
- ✅ Isolated from development database
- ✅ Can be reset before each run
- ✅ Cleaner separation

**Cons:**
- More complex setup
- Requires additional database

## 🔧 Recommended Fix

**Best approach**: Solution 1 + Solution 3 hybrid

1. Create a global setup hook for E2E tests that:
   - Ensures database schema is up-to-date
   - Seeds the database with test users
   - Verifies users exist before tests run

2. Optionally use a separate test database for E2E tests

## 📝 Next Steps

1. **Verify the issue**: Check if test users exist in the database
2. **Check database connection**: Ensure backend can connect to database
3. **Implement auto-seeding**: Add global setup to seed database before tests
4. **Test the fix**: Run E2E tests and verify login works

## 🔍 How to Verify the Issue

### Check if users exist:

```bash
# Connect to database
psql -h localhost -U postgres -d construction_pricing

# Check for test users
SELECT email, role, status, "isActive" FROM users WHERE email IN (
  'admin@system.com',
  'supplier@example.com', 
  'company@example.com'
);
```

### Check backend health:

```bash
curl http://localhost:8000/health
```

### Check login endpoint directly:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supplier@example.com","password":"password123"}'
```

## 💡 Quick Diagnostic Checklist

- [ ] Is the database running?
- [ ] Is the backend server running and accessible?
- [ ] Does the database have the correct schema (migrations applied)?
- [ ] Have test users been seeded in the database?
- [ ] Are the credentials correct (email/password)?
- [ ] Is the backend connecting to the right database?

