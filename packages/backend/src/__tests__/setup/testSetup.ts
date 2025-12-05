import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';

let prisma: PrismaClient;
let isDatabaseInitialized = false;

/**
 * Initialize test database
 */
export async function setupTestDatabase() {
  if (isDatabaseInitialized) {
    return;
  }

  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set');
  }

  // Set environment variable for Prisma
  process.env.DATABASE_URL = testDbUrl;

  // Generate Prisma client (skip if already generated, e.g., in CI)
  // This is safe to run multiple times, but we'll make it non-blocking
  try {
    execSync('npx prisma generate', {
      cwd: join(__dirname, '../../..'),
      stdio: process.env.CI ? 'pipe' : 'inherit', // Less verbose in CI
    });
  } catch (error) {
    // Ignore errors - Prisma client might already be generated
    if (!process.env.CI) {
      console.warn('Note: Prisma generate may have already run. Continuing...');
    }
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  // Connect to database first
  await prisma.$connect();

  // Ensure database schema is up to date
  if (process.env.CI) {
    // In CI, migrations should already be run - verify tables exist
    try {
      await prisma.$queryRaw`SELECT 1 FROM "tenants" LIMIT 1`;
    } catch (error: any) {
      // Tables don't exist - try to run migrations as fallback
      console.warn('Tables not found in CI, attempting to run migrations...');
      try {
        execSync('npx prisma migrate deploy', {
          cwd: join(__dirname, '../../..'), // packages/backend directory
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: testDbUrl },
        });
        // Verify again after migrations
        await prisma.$queryRaw`SELECT 1 FROM "tenants" LIMIT 1`;
      } catch (migrateError: any) {
        throw new Error(
          `Database setup failed in CI: Tables do not exist and migrations failed. ` +
          `Error: ${migrateError?.message || error?.message}`
        );
      }
    }
  } else {
    // For local tests, use db push which is more reliable
    try {
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        cwd: join(__dirname, '../../..'),
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: testDbUrl },
      });
    } catch (error: any) {
      throw new Error(
        `Database setup failed: Could not push schema. ` +
        `Make sure your test database is accessible. ` +
        `Error: ${error?.message}`
      );
    }
  }
  
  isDatabaseInitialized = true;
}

/**
 * Helper to safely delete from a table, ignoring missing table errors
 */
async function safeDeleteMany(prisma: PrismaClient, model: any, tableName: string): Promise<void> {
  try {
    await model.deleteMany({});
  } catch (error: any) {
    // Check if it's a Prisma error (case-insensitive matching)
    const errorMessage = String(error?.message || '').toLowerCase();
    const errorCode = String(error?.code || '');
    const errorName = String(error?.name || '');
    
    // Ignore table missing errors - check various patterns
    const isTableMissingError = 
      errorMessage.includes('does not exist') ||
      errorMessage.includes('does not exist in the current database') ||
      errorMessage.includes('relation') ||
      (errorMessage.includes('table') && errorMessage.includes('not exist')) ||
      errorCode === 'P2021' ||  // Table does not exist
      errorCode === '42P01';     // PostgreSQL undefined table
    
    if (isTableMissingError) {
      // Table doesn't exist, skip silently
      return;
    }
    
    // For connection errors, also skip (database might not be available)
    const isConnectionError =
      errorMessage.includes("can't reach database") ||
      errorMessage.includes('cannot reach database') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('connection') ||
      errorCode === 'P1001' ||    // Can't reach database server
      errorCode === 'P1000' ||    // Authentication failed
      errorName === 'PrismaClientInitializationError';
    
    if (isConnectionError) {
      // Database not available, skip cleanup
      return;
    }
    
    // Re-throw other unexpected errors
    throw error;
  }
}

/**
 * Clean test database - truncate all tables
 */
export async function cleanTestDatabase() {
  if (!prisma) {
    return;
  }

  // Delete in correct order to respect foreign key constraints
  // Use safe deletion to handle missing tables gracefully
  await safeDeleteMany(prisma, prisma.priceView, 'price_views');
  await safeDeleteMany(prisma, prisma.priceAuditLog, 'price_audit_log');
  await safeDeleteMany(prisma, prisma.privatePrice, 'private_prices');
  await safeDeleteMany(prisma, prisma.defaultPrice, 'default_prices');
  await safeDeleteMany(prisma, prisma.product, 'products');
  await safeDeleteMany(prisma, prisma.user, 'users');
  await safeDeleteMany(prisma, prisma.tenant, 'tenants');
}

/**
 * Get test Prisma client
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call setupTestDatabase() first.');
  }
  return prisma;
}

/**
 * Close database connection
 */
export async function closeTestDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}


