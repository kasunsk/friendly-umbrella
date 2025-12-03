import { prisma } from '../utils/prisma';
import createError from 'http-errors';

export interface ApproveTenantInput {
  tenantId: string;
  approved: boolean;
  reason?: string;
}

export interface CreateSuperAdminInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class SuperAdminService {
  /**
   * Get all pending tenant registration requests
   */
  async getPendingTenants() {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'pending',
      },
      include: {
        users: {
          where: {
            role: {
              in: ['supplier_admin', 'company_admin'],
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tenants;
  }

  /**
   * Get all tenants (with filtering by status and type)
   */
  async getAllTenants(status?: 'pending' | 'active' | 'rejected', type?: 'company' | 'supplier', page = 1, limit = 20) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }

    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          users: {
            where: {
              role: {
                in: ['supplier_admin', 'company_admin'],
              },
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
            take: 1,
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve or reject a tenant registration request
   */
  async approveTenant(
    tenantId: string,
    approved: boolean,
    superAdminId: string,
    reason?: string
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: {
            role: {
              in: ['supplier_admin', 'company_admin'],
            },
          },
        },
      },
    });

    if (!tenant) {
      throw createError(404, 'Tenant not found');
    }

    if (tenant.status !== 'pending') {
      throw createError(400, `Tenant is already ${tenant.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // Update tenant status
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: approved ? 'active' : 'rejected',
          isActive: approved,
          approvedBy: approved ? superAdminId : null,
          approvedAt: approved ? new Date() : null,
          rejectedBy: approved ? null : superAdminId,
          rejectedAt: approved ? null : new Date(),
          rejectionReason: approved ? null : reason,
        },
      });

      if (approved) {
        // Activate the admin user (first admin user of the tenant)
        const adminUser = tenant.users[0];
        if (adminUser) {
          await tx.user.update({
            where: { id: adminUser.id },
            data: {
              status: 'active',
              isActive: true,
              approvedBy: superAdminId,
              approvedAt: new Date(),
            },
          });
        }
      }

      return updatedTenant;
    });
  }

  /**
   * Toggle tenant active status
   */
  async toggleTenantStatus(tenantId: string, isActive: boolean, superAdminId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw createError(404, 'Tenant not found');
    }

    if (tenant.status !== 'active') {
      throw createError(400, 'Can only toggle active status for approved tenants');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        isActive,
      },
    });
  }

  /**
   * Get all super admins
   */
  async getSuperAdmins() {
    const admins = await prisma.user.findMany({
      where: {
        role: 'super_admin',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return admins;
  }

  /**
   * Create a new super admin
   */
  async createSuperAdmin(input: CreateSuperAdminInput, createdBy: string) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw createError(409, 'Email already registered');
    }

    // Hash password
    const { hashPassword } = await import('../utils/password');
    const passwordHash = await hashPassword(input.password);

    // Create super admin user (no tenant)
    const superAdmin = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'super_admin',
        status: 'active', // Super admins are auto-approved
        isActive: true,
        tenantId: null, // Super admins don't belong to a tenant
      },
    });

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      status: superAdmin.status,
      isActive: superAdmin.isActive,
    };
  }

  /**
   * Get tenant statistics
   */
  async getStatistics() {
    const [pendingTenants, activeTenants, rejectedTenants, totalUsers, companies, suppliers] =
      await Promise.all([
        prisma.tenant.count({ where: { status: 'pending' } }),
        prisma.tenant.count({ where: { status: 'active' } }),
        prisma.tenant.count({ where: { status: 'rejected' } }),
        prisma.user.count({ where: { role: { not: 'super_admin' } } }),
        prisma.tenant.count({ where: { type: 'company' } }),
        prisma.tenant.count({ where: { type: 'supplier' } }),
      ]);

    return {
      tenants: {
        pending: pendingTenants,
        active: activeTenants,
        rejected: rejectedTenants,
        companies: companies,
        suppliers: suppliers,
      },
      users: {
        total: totalUsers,
      },
    };
  }
}

export const superAdminService = new SuperAdminService();





