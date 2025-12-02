import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  tenantId?: string | null;
  userRole?: string;
  tenantType?: string;
  userPermissions?: Record<string, any>;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError(401, 'No token provided');
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      tenantId: string;
      role: string;
      tenantType: string;
    };

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive || user.status !== 'active') {
      throw createError(401, 'User is inactive or pending approval');
    }

    // Handle super admin (no tenant)
    if (user.role === 'super_admin') {
      req.userId = decoded.userId;
      req.tenantId = null;
      req.userRole = decoded.role;
      req.tenantType = 'system';
      req.userPermissions = {};
      next();
      return;
    }

    // Regular users must have active tenant
    if (!user.tenant) {
      throw createError(403, 'User account is invalid');
    }

    if (!user.tenant.isActive || user.tenant.status !== 'active') {
      throw createError(403, 'Tenant is inactive or pending approval');
    }

    // Attach user info to request
    req.userId = decoded.userId;
    req.tenantId = user.tenantId;
    req.userRole = decoded.role;
    req.tenantType = user.tenant.type;
    req.userPermissions = (user.permissions as Record<string, any>) || {};

    // Debug logging (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth Debug:', {
        userId: req.userId,
        tenantId: req.tenantId,
        tenantType: req.tenantType,
        userRole: req.userRole,
        path: req.path,
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return next(createError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(createError(403, 'Insufficient permissions'));
    }

    next();
  };
}

export function requireTenantType(...allowedTypes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.tenantType) {
      return next(createError(401, 'Authentication required'));
    }

    if (!allowedTypes.includes(req.tenantType)) {
      return next(createError(403, `Invalid tenant type. Expected one of: ${allowedTypes.join(', ')}, but got: ${req.tenantType}`));
    }

    next();
  };
}

export function requireSuperAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return next(createError(401, 'Authentication required'));
    }

    if (req.userRole !== 'super_admin') {
      return next(createError(403, 'Super admin access required'));
    }

    next();
  };
}

export function requireTenantAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return next(createError(401, 'Authentication required'));
    }

    const adminRoles = ['supplier_admin', 'company_admin', 'super_admin'];
    if (!adminRoles.includes(req.userRole)) {
      return next(createError(403, 'Tenant admin access required'));
    }

    next();
  };
}

/**
 * Check if user has permission for a specific resource and action
 * Example: requirePermission('products', 'update')
 */
export function requirePermission(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return next(createError(401, 'Authentication required'));
    }

    // Super admins and tenant admins have all permissions
    const adminRoles = ['super_admin', 'supplier_admin', 'company_admin'];
    if (adminRoles.includes(req.userRole)) {
      next();
      return;
    }

    // Check granular permissions for staff users
    const permissions = req.userPermissions || {};
    const resourcePermissions = permissions[resource];

    if (!resourcePermissions || !resourcePermissions[action]) {
      return next(
        createError(403, `Permission denied: ${resource}.${action} is required`)
      );
    }

    next();
  };
}


