import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import {
  authenticate,
  requireRole,
  requireTenantType,
  requireSuperAdmin,
  requireTenantAdmin,
  requirePermission,
  AuthRequest,
} from '../auth';
import { prisma } from '../../utils/prisma';
import { generateAccessToken } from '../../utils/jwt';

// Mock Prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock JWT secret
const mockJwtSecret = 'test-jwt-secret-key-for-unit-tests-minimum-32-characters-long';

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    process.env.JWT_SECRET = mockJwtSecret;
    process.env.NODE_ENV = 'test';

    mockRequest = {
      headers: {},
      path: '/test',
      method: 'GET',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate request with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier_admin',
        isActive: true,
        status: 'active',
        tenantId: 'tenant-123',
        permissions: { view: true, create: true },
        tenant: {
          id: 'tenant-123',
          type: 'supplier',
          isActive: true,
          status: 'active',
        },
      };

      const token = generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'supplier_admin',
        tenantType: 'supplier',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.userId).toBe('user-123');
      expect(mockRequest.tenantId).toBe('tenant-123');
      expect(mockRequest.userRole).toBe('supplier_admin');
      expect(mockRequest.tenantType).toBe('supplier');
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('No token provided');
    });

    it('should reject request with invalid token format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token' };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid.token.here' };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should reject request if user not found', async () => {
      const token = generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'supplier_admin',
        tenantType: 'supplier',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should reject request if user is inactive', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier_admin',
        isActive: false,
        status: 'pending',
        tenantId: 'tenant-123',
        tenant: null,
      };

      const token = generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'supplier_admin',
        tenantType: 'supplier',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should authenticate super admin without tenant', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@system.com',
        role: 'super_admin',
        isActive: true,
        status: 'active',
        tenantId: null,
        permissions: {},
        tenant: null,
      };

      const token = generateAccessToken({
        userId: 'user-123',
        tenantId: '',
        role: 'super_admin',
        tenantType: 'system',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.userId).toBe('user-123');
      expect(mockRequest.tenantId).toBeNull();
      expect(mockRequest.userRole).toBe('super_admin');
      expect(mockRequest.tenantType).toBe('system');
    });

    it('should reject request if tenant is inactive', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier_admin',
        isActive: true,
        status: 'active',
        tenantId: 'tenant-123',
        permissions: {},
        tenant: {
          id: 'tenant-123',
          type: 'supplier',
          isActive: false,
          status: 'pending',
        },
      };

      const token = generateAccessToken({
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'supplier_admin',
        tenantType: 'supplier',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticate(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe('requireRole', () => {
    it('should allow access for matching role', () => {
      mockRequest.userRole = 'supplier_admin';
      const middleware = requireRole('supplier_admin', 'company_admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for non-matching role', () => {
      mockRequest.userRole = 'supplier_staff';
      const middleware = requireRole('supplier_admin', 'company_admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('should require authentication', () => {
      mockRequest.userRole = undefined;
      const middleware = requireRole('supplier_admin');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });

  describe('requireTenantType', () => {
    it('should allow access for matching tenant type', () => {
      mockRequest.tenantType = 'supplier';
      const middleware = requireTenantType('supplier');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for non-matching tenant type', () => {
      mockRequest.tenantType = 'company';
      const middleware = requireTenantType('supplier');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('should require authentication', () => {
      mockRequest.tenantType = undefined;
      const middleware = requireTenantType('supplier');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });

  describe('requireSuperAdmin', () => {
    it('should allow access for super admin', () => {
      mockRequest.userRole = 'super_admin';
      const middleware = requireSuperAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for non-super admin', () => {
      mockRequest.userRole = 'supplier_admin';
      const middleware = requireSuperAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe('requireTenantAdmin', () => {
    it('should allow access for supplier admin', () => {
      mockRequest.userRole = 'supplier_admin';
      const middleware = requireTenantAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for company admin', () => {
      mockRequest.userRole = 'company_admin';
      const middleware = requireTenantAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for super admin', () => {
      mockRequest.userRole = 'super_admin';
      const middleware = requireTenantAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for staff user', () => {
      mockRequest.userRole = 'supplier_staff';
      const middleware = requireTenantAdmin();

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe('requirePermission', () => {
    it('should allow access for super admin', () => {
      mockRequest.userRole = 'super_admin';
      const middleware = requirePermission('products', 'update');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for tenant admin', () => {
      mockRequest.userRole = 'supplier_admin';
      const middleware = requirePermission('products', 'update');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access if user has permission', () => {
      mockRequest.userRole = 'supplier_staff';
      mockRequest.userPermissions = {
        products: {
          update: true,
        },
      };
      const middleware = requirePermission('products', 'update');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access if user lacks permission', () => {
      mockRequest.userRole = 'supplier_staff';
      mockRequest.userPermissions = {
        products: {
          view: true,
        },
      };
      const middleware = requirePermission('products', 'update');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('should deny access if resource not found in permissions', () => {
      mockRequest.userRole = 'supplier_staff';
      mockRequest.userPermissions = {};
      const middleware = requirePermission('products', 'update');

      middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });
});

