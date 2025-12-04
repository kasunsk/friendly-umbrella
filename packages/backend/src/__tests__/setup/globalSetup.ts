import { setupTestDatabase, cleanTestDatabase, closeTestDatabase } from './testSetup';

/**
 * Global setup for all integration tests
 * This runs once before all tests
 */
export async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-integration-tests';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  
  // Initialize test database
  await setupTestDatabase();
}

/**
 * Global teardown for all integration tests
 * This runs once after all tests
 */
export async function globalTeardown() {
  await closeTestDatabase();
}

/**
 * Setup before each test file
 */
export async function beforeEachSetup() {
  // Clean database before each test file
  const { getTestPrisma } = await import('./testSetup');
  const prisma = getTestPrisma();
  
  // Clean all tables
  await cleanTestDatabase();
}

/**
 * Teardown after each test file
 */
export async function afterEachTeardown() {
  // Optional: Add cleanup logic if needed
}

