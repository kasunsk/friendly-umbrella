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
  email?: string,
  password: string = 'password123'
): Promise<TestUser> {
  const passwordHash = await hashPassword(password);
  // Use random email by default to avoid unique constraint conflicts
  const adminEmail = email || randomEmail();
  
  const user = await prisma.user.create({
    data: {
      email: adminEmail,
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
 * Note: Tenant must exist before calling this. For atomic creation, use createTestTenantWithAdmin.
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
  
  // Get tenant type - use provided tenantType if available, otherwise lookup
  let tenantType: TenantType;
  let tenant;
  
  if (options.tenantType) {
    tenantType = options.tenantType;
    // Still verify tenant exists even if we have the type
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  } else {
    // Lookup tenant to get type - retry if not found (connection pool delay)
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    // Retry with exponential backoff if tenant not found
    if (!tenant) {
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (tenant) break;
      }
    }
    
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found. Make sure the tenant was created and committed before creating admin.`);
    }
    
    tenantType = tenant.type;
  }

  // Final verification that tenant exists before creating user
  if (!tenant) {
    // One more attempt with a longer wait
    await new Promise(resolve => setTimeout(resolve, 200));
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  if (!tenant) {
    throw new Error(`Cannot create user: Tenant ${tenantId} does not exist. Foreign key constraint requires tenant to exist first. Make sure the tenant was created and committed in a previous step.`);
  }

  const role = options.role || (tenantType === TenantType.supplier 
    ? UserRole.supplier_admin 
    : UserRole.company_admin);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: options.email || randomEmail(),
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
    tenantType: tenantType === TenantType.supplier ? 'supplier' : 'company',
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
 * Create a test tenant with admin user in a single transaction
 * This ensures atomicity and avoids foreign key constraint issues
 */
export async function createTestTenantWithAdmin(
  prisma: PrismaClient,
  tenantOptions: {
    name?: string;
    type: TenantType;
    email?: string;
    status?: TenantStatus;
  },
  adminOptions: {
    email?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
  } = {}
): Promise<{ tenant: TestTenant; admin: TestUser }> {
  const passwordHash = await hashPassword(adminOptions.password || 'password123');
  
  const role = adminOptions.role || (tenantOptions.type === TenantType.supplier 
    ? UserRole.supplier_admin 
    : UserRole.company_admin);

  // Create both tenant and admin in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name: tenantOptions.name || `${tenantOptions.type} Test Company`,
        type: tenantOptions.type,
        email: tenantOptions.email || randomEmail(),
        phone: '+1234567890',
        address: '123 Test St',
        postalCode: '12345',
        status: tenantOptions.status || TenantStatus.active,
        isActive: tenantOptions.status === TenantStatus.active,
      },
    });

    // Create admin user (tenant exists in same transaction)
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminOptions.email || randomEmail(),
        passwordHash,
        firstName: 'Tenant',
        lastName: 'Admin',
        role,
        status: adminOptions.status || UserStatus.active,
        isActive: adminOptions.status === UserStatus.active,
      },
    });

    return { tenant, user };
  });

  const accessToken = generateAccessToken({
    userId: result.user.id,
    tenantId: result.user.tenantId || '',
    role: result.user.role,
    tenantType: result.tenant.type === TenantType.supplier ? 'supplier' : 'company',
  });

  return {
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      type: result.tenant.type,
      email: result.tenant.email,
      status: result.tenant.status as TenantStatus,
    },
    admin: {
      id: result.user.id,
      email: result.user.email,
      password: adminOptions.password || 'password123',
      role: result.user.role,
      tenantId: result.user.tenantId || undefined,
      accessToken,
    },
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
    tenantType?: TenantType;
  }
): Promise<TestUser> {
  const passwordHash = await hashPassword(options.password || 'password123');
  
  // Try to get tenant type - use provided tenantType if available, otherwise lookup
  let tenantType: TenantType;
  let tenant;
  
  if (options.tenantType) {
    tenantType = options.tenantType;
    // Still verify tenant exists even if we have the type
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  } else {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      // Retry with exponential backoff
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (tenant) break;
      }
    }

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found. Make sure the tenant was created and committed before creating staff user.`);
    }
    
    tenantType = tenant.type;
  }

  // Final verification that tenant exists before creating user
  if (!tenant) {
    await new Promise(resolve => setTimeout(resolve, 200));
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  if (!tenant) {
    throw new Error(`Cannot create staff user: Tenant ${tenantId} does not exist. Foreign key constraint requires tenant to exist first.`);
  }

  const role = options.role || (tenantType === TenantType.supplier 
    ? UserRole.supplier_staff 
    : UserRole.company_staff);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: options.email || randomEmail(),
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
    tenantType: tenantType === TenantType.supplier ? 'supplier' : 'company',
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


