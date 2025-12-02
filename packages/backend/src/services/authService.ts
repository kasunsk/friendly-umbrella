import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import createError from 'http-errors';

export interface RegisterInput {
  tenantName: string;
  tenantType: 'supplier' | 'company';
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
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

    // Check if tenant email already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { email: input.email },
    });

    if (existingTenant) {
      throw createError(409, 'Email already registered');
    }

    // Determine role based on tenant type if not provided
    let role = input.role;
    if (!role) {
      role = input.tenantType === 'supplier' ? 'supplier_admin' : 'company_admin';
    }

    // Create tenant and user in transaction - both start as pending
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant with pending status
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          type: input.tenantType,
          email: input.email,
          status: 'pending',
          isActive: false,
        },
      });

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user with pending status
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
        },
        include: {
          tenant: true,
        },
      });

      return { user, tenant };
    });

    // Don't generate tokens - user must wait for approval
    // Return a message indicating pending approval
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







