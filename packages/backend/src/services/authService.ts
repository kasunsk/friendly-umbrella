import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import createError from 'http-errors';

export interface RegisterInput {
  registrationType: 'new_company' | 'new_supplier' | 'new_company_user' | 'new_supplier_user';
  tenantName?: string; // Required for new_company and new_supplier
  tenantType?: 'supplier' | 'company'; // Required for new_company and new_supplier
  tenantId?: string; // Required for new_company_user and new_supplier_user
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // Required for new_company and new_supplier
  address?: string; // Required for new_company and new_supplier
  postalCode?: string; // Required for new_company and new_supplier
  role?: string;
  permissions?: Record<string, any>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    // Validate email is unique
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw createError(409, 'Email already registered');
    }

    // Handle different registration types
    if (input.registrationType === 'new_company' || input.registrationType === 'new_supplier') {
      return this.registerNewTenant(input);
    } else if (input.registrationType === 'new_company_user' || input.registrationType === 'new_supplier_user') {
      return this.registerNewUser(input);
    } else {
      throw createError(400, 'Invalid registration type');
    }
  }

  /**
   * Register a new company or supplier (creates tenant + admin user)
   */
  private async registerNewTenant(input: RegisterInput) {
    if (!input.tenantName || !input.tenantType) {
      throw createError(400, 'Tenant name and type are required for new tenant registration');
    }

    // Check if tenant email already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { email: input.email },
    });

    if (existingTenant) {
      throw createError(409, 'Email already registered');
    }

    // Determine role - admin for new tenant creators
    const role = input.tenantType === 'supplier' ? 'supplier_admin' : 'company_admin';

    // Create tenant and user in transaction - both start as pending
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant with pending status
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName!,
          type: input.tenantType!,
          email: input.email,
          phone: input.phone || null,
          address: input.address || null,
          postalCode: input.postalCode || null,
          status: 'pending',
          isActive: false,
        },
      });

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user with pending status (but will become admin once tenant is approved)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: role as any,
          status: 'pending',
          isActive: false,
          permissions: { view: true, create: true, admin: true }, // Full admin permissions
        },
        include: {
          tenant: true,
        },
      });

      return { user, tenant };
    });

    return {
      message: 'Registration successful. Your account is pending approval by a super administrator.',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        status: result.user.status,
        tenantId: result.user.tenantId,
        tenantType: result.tenant.type,
        tenantStatus: result.tenant.status,
      },
    };
  }

  /**
   * Register a new user for existing company or supplier
   */
  private async registerNewUser(input: RegisterInput) {
    if (!input.tenantId) {
      throw createError(400, 'Tenant ID is required for new user registration');
    }

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });

    if (!tenant) {
      throw createError(404, 'Tenant not found');
    }

    if (tenant.status !== 'active' || !tenant.isActive) {
      throw createError(403, 'Cannot register users for inactive or pending tenants');
    }

    // Determine role based on tenant type
    const defaultRole = tenant.type === 'supplier' ? 'supplier_staff' : 'company_staff';
    const role = input.role || defaultRole;

    // Validate role matches tenant type
    if (tenant.type === 'supplier' && !['supplier_admin', 'supplier_staff'].includes(role)) {
      throw createError(400, 'Invalid role for supplier tenant');
    }
    if (tenant.type === 'company' && !['company_admin', 'company_staff'].includes(role)) {
      throw createError(400, 'Invalid role for company tenant');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user with pending status - needs admin approval
    const user = await prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: role as any,
        status: 'pending',
        isActive: false,
        permissions: input.permissions || { view: true, create: false, admin: false }, // Default permissions
      },
      include: {
        tenant: true,
      },
    });

    return {
      message: 'Registration successful. Your account is pending approval by your organization administrator.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantType: tenant.type,
        tenantStatus: tenant.status,
      },
    };
  }

  async login(input: LoginInput) {
    // Find user (with optional tenant for super admins)
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: true },
    });

    if (!user) {
      throw createError(401, 'Invalid email or password');
    }

    // Verify password first before checking status
    const isValid = await comparePassword(input.password, user.passwordHash);

    if (!isValid) {
      throw createError(401, 'Invalid email or password');
    }

    // Check if user is a super admin (no tenant)
    if (user.role === 'super_admin') {
      if (user.status !== 'active' || !user.isActive) {
        throw createError(403, 'Account is pending approval or inactive');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate tokens for super admin (tenantId is null)
      const accessToken = generateAccessToken({
        userId: user.id,
        tenantId: user.tenantId || '',
        role: user.role,
        tenantType: 'system', // Special type for super admins
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        tenantId: user.tenantId || '',
        role: user.role,
        tenantType: 'system',
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenantType: 'system',
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    }

    // Regular user - must have tenant
    if (!user.tenant) {
      throw createError(403, 'User account is invalid');
    }

    // Check tenant and user status
    if (user.tenant.status !== 'active' || !user.tenant.isActive) {
      throw createError(403, 'Your company/supplier account is pending approval by a super administrator');
    }

    if (user.status !== 'active' || !user.isActive) {
      throw createError(403, 'Your user account is pending approval by your organization administrator');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId!,
      role: user.role,
      tenantType: user.tenant.type,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      tenantId: user.tenantId!,
      role: user.role,
      tenantType: user.tenant.type,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantType: user.tenant.type,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const { verifyRefreshToken, generateAccessToken: generateToken } = await import(
      '../utils/jwt'
    );

    try {
      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { tenant: true },
      });

      if (!user || !user.isActive || user.status !== 'active') {
        throw createError(401, 'User is inactive or pending approval');
      }

      // Handle super admin refresh
      if (user.role === 'super_admin') {
        const accessToken = generateToken({
          userId: user.id,
          tenantId: user.tenantId || '',
          role: user.role,
          tenantType: 'system',
        });
        return { accessToken };
      }

      // Regular user - must have active tenant
      if (!user.tenant || !user.tenant.isActive || user.tenant.status !== 'active') {
        throw createError(401, 'Tenant is inactive or pending approval');
      }

      // Generate new access token
      const accessToken = generateToken({
        userId: user.id,
        tenantId: user.tenantId!,
        role: user.role,
        tenantType: user.tenant.type,
      });

      return { accessToken };
    } catch (error) {
      throw createError(401, 'Invalid refresh token');
    }
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      throw createError(404, 'User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenant: user.tenant,
    };
  }
}

export const authService = new AuthService();







