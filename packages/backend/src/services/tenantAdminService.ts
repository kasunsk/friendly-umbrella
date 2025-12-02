import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import createError from 'http-errors';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'supplier_staff' | 'company_staff';
  permissions?: Record<string, any>;
}

export interface UpdateUserPermissionsInput {
  userId: string;
  permissions: Record<string, any>;
}

export interface ApproveUserInput {
  userId: string;
  approved: boolean;
  reason?: string;
}

export class TenantAdminService {
  /**
   * Get all pending user requests for a tenant
   */
  async getPendingUsers(tenantId: string) {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'pending',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  /**
   * Get all users in a tenant
   */
  async getTenantUsers(tenantId: string, status?: 'pending' | 'active' | 'rejected') {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        approvedBy: true,
        approvedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  /**
   * Create a new user in the tenant (requires approval)
   */
  async createUser(input: CreateUserInput, tenantId: string, createdBy: string) {
    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw createError(404, 'Tenant not found');
    }

    if (tenant.status !== 'active' || !tenant.isActive) {
      throw createError(403, 'Tenant is not active');
    }

    // Verify email is unique
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw createError(409, 'Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user with pending status
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        status: 'pending',
        isActive: false,
        permissions: input.permissions || {},
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    };
  }

  /**
   * Approve or reject a user request
   */
  async approveUser(
    userId: string,
    tenantId: string,
    approved: boolean,
    adminId: string,
    reason?: string
  ) {
    // Verify user belongs to tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError(404, 'User not found');
    }

    if (user.tenantId !== tenantId) {
      throw createError(403, 'User does not belong to this tenant');
    }

    if (user.status !== 'pending') {
      throw createError(400, `User is already ${user.status}`);
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: approved ? 'active' : 'rejected',
        isActive: approved,
        approvedBy: approved ? adminId : null,
        approvedAt: approved ? new Date() : null,
        rejectedBy: approved ? null : adminId,
        rejectedAt: approved ? null : new Date(),
        rejectionReason: approved ? null : reason,
      },
    });

    return updatedUser;
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    userId: string,
    tenantId: string,
    permissions: Record<string, any>,
    adminId: string
  ) {
    // Verify user belongs to tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError(404, 'User not found');
    }

    if (user.tenantId !== tenantId) {
      throw createError(403, 'User does not belong to this tenant');
    }

    // Admins cannot modify their own permissions
    if (user.id === adminId && (user.role === 'supplier_admin' || user.role === 'company_admin')) {
      throw createError(403, 'Cannot modify own admin permissions');
    }

    // Update permissions
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        permissions,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
      },
    });

    return updatedUser;
  }

  /**
   * Update user role (promote/demote)
   */
  async updateUserRole(
    userId: string,
    tenantId: string,
    newRole: 'supplier_admin' | 'supplier_staff' | 'company_admin' | 'company_staff',
    adminId: string
  ) {
    // Verify user belongs to tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError(404, 'User not found');
    }

    if (user.tenantId !== tenantId) {
      throw createError(403, 'User does not belong to this tenant');
    }

    // Cannot modify own role
    if (user.id === adminId) {
      throw createError(403, 'Cannot modify own role');
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return updatedUser;
  }

  /**
   * Deactivate or activate a user
   */
  async toggleUserStatus(
    userId: string,
    tenantId: string,
    isActive: boolean,
    adminId: string
  ) {
    // Verify user belongs to tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createError(404, 'User not found');
    }

    if (user.tenantId !== tenantId) {
      throw createError(403, 'User does not belong to this tenant');
    }

    // Cannot deactivate self
    if (user.id === adminId) {
      throw createError(403, 'Cannot modify own status');
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        status: isActive ? 'active' : 'pending',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isActive: true,
      },
    });

    return updatedUser;
  }

  /**
   * Get tenant statistics
   */
  async getTenantStatistics(tenantId: string) {
    const [totalUsers, pendingUsers, activeUsers, rejectedUsers] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, status: 'pending' } }),
      prisma.user.count({ where: { tenantId, status: 'active' } }),
      prisma.user.count({ where: { tenantId, status: 'rejected' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        pending: pendingUsers,
        active: activeUsers,
        rejected: rejectedUsers,
      },
    };
  }
}

export const tenantAdminService = new TenantAdminService();



