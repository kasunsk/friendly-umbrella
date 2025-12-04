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

  // Generate Prisma client
  try {
    execSync('npx prisma generate', {
      cwd: join(__dirname, '../../..'),
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to generate Prisma client:', error);
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  // Run migrations
  try {
    execSync('npx prisma migrate deploy', {
      cwd: join(__dirname, '../../..'),
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
  } catch (error) {
    console.error('Failed to run migrations:', error);
  }

  isDatabaseInitialized = true;
}

/**
 * Clean test database - truncate all tables
 */
export async function cleanTestDatabase() {
  if (!prisma) {
    return;
  }

  // Delete in correct order to respect foreign key constraints
  await prisma.priceView.deleteMany({});
  await prisma.priceAuditLog.deleteMany({});
  await prisma.privatePrice.deleteMany({});
  await prisma.defaultPrice.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});
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


