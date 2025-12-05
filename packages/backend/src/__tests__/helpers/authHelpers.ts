import { PrismaClient, UserRole, UserStatus, TenantType, TenantStatus } from '@prisma/client';
import { hashPassword } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { randomEmail } from './testHelpers';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  tenantId?: string | null;
  accessToken?: string;
}

export interface TestTenant {
  id: string;
  name: string;
  type: TenantType;
  email: string;
  status: TenantStatus;
}

/**
 * Create a test super admin user
 */
export async function createTestSuperAdmin(
  prisma: PrismaClient,
  email: string = 'superadmin@test.com',
  password: string = 'password123'
): Promise<TestUser> {
  const passwordHash = await hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.super_admin,
      status: UserStatus.active,
      isActive: true,
      tenantId: null,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: '',
    role: user.role,
    tenantType: 'system',
  });

  return {
    id: user.id,
    email: user.email,
    password,
    role: user.role,
    tenantId: null,
    accessToken,
  };
}

/**
 * Create a test tenant (supplier or company)
 */
export async function createTestTenant(
  prisma: PrismaClient,
  options: {
    name?: string;
    type: TenantType;
    email?: string;
    status?: TenantStatus;
  }
): Promise<TestTenant> {
  // Use random email if not provided to avoid unique constraint conflicts
  const tenant = await prisma.tenant.create({
    data: {
      name: options.name || `${options.type} Test Company`,
      type: options.type,
      email: options.email || randomEmail(),
      phone: '+1234567890',
      address: '123 Test St',
      postalCode: '12345',
      status: options.status || TenantStatus.active,
      isActive: options.status === TenantStatus.active,
    },
  });

  return {
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    email: tenant.email,
    status: tenant.status as TenantStatus,
  };
}

/**
 * Create a test tenant admin user
 */
export async function createTestTenantAdmin(
  prisma: PrismaClient,
  tenantId: string,
  options: {
    email?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
    tenantType?: TenantType;
  }
): Promise<TestUser> {
  const passwordHash = await hashPassword(options.password || 'password123');
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const role = options.role || (tenant.type === TenantType.supplier 
    ? UserRole.supplier_admin 
    : UserRole.company_admin);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: options.email || `admin@${tenant.type}.test.com`,
      passwordHash,
      firstName: 'Tenant',
      lastName: 'Admin',
      role,
      status: options.status || UserStatus.active,
      isActive: options.status === UserStatus.active,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: user.tenantId || '',
    role: user.role,
    tenantType: tenant.type === TenantType.supplier ? 'supplier' : 'company',
  });

  return {
    id: user.id,
    email: user.email,
    password: options.password || 'password123',
    role: user.role,
    tenantId: user.tenantId || undefined,
    accessToken,
  };
}

/**
 * Create a test staff user
 */
export async function createTestStaff(
  prisma: PrismaClient,
  tenantId: string,
  options: {
    email?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
  }
): Promise<TestUser> {
  const passwordHash = await hashPassword(options.password || 'password123');
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const role = options.role || (tenant.type === TenantType.supplier 
    ? UserRole.supplier_staff 
    : UserRole.company_staff);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: options.email || `staff@${tenant.type}.test.com`,
      passwordHash,
      firstName: 'Staff',
      lastName: 'User',
      role,
      status: options.status || UserStatus.active,
      isActive: options.status === UserStatus.active,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: user.tenantId || '',
    role: user.role,
    tenantType: tenant.type === TenantType.supplier ? 'supplier' : 'company',
  });

  return {
    id: user.id,
    email: user.email,
    password: options.password || 'password123',
    role: user.role,
    tenantId: user.tenantId || undefined,
    accessToken,
  };
}


