import { Router, Response, NextFunction } from 'express';
import { tenantAdminService } from '../services/tenantAdminService';
import { authenticate, AuthRequest, requireTenantAdmin } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import { z } from 'zod';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['supplier_staff', 'company_staff']),
  permissions: z.record(z.any()).optional(),
});

const approveUserSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.record(z.any()),
});

const updateRoleSchema = z.object({
  role: z.enum(['supplier_admin', 'supplier_staff', 'company_admin', 'company_staff']),
});

// Apply authentication and tenant admin check to all routes
router.use(authenticate, requireTenantAdmin());

// GET /api/v1/tenant-admin/users/pending - Get all pending user requests
router.get(
  '/users/pending',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const users = await tenantAdminService.getPendingUsers(tenantId);
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/tenant-admin/users - Get all users in tenant
router.get(
  '/users',
  [
    query('status').optional().isIn(['pending', 'active', 'rejected']),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.tenantId!;
      const status = req.query.status as 'pending' | 'active' | 'rejected' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await tenantAdminService.getTenantUsers(tenantId, status, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/tenant-admin/users - Create a new user (pending approval)
router.post(
  '/users',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
    body('role').isIn(['supplier_staff', 'company_staff']),
    body('permissions').optional().isObject(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = createUserSchema.parse(req.body);
      const tenantId = req.tenantId!;
      const createdBy = req.userId!;

      const user = await tenantAdminService.createUser(input, tenantId, createdBy);

      res.status(201).json({
        message: 'User created successfully. Awaiting approval.',
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// POST /api/v1/tenant-admin/users/:userId/approve - Approve or reject a user
router.post(
  '/users/:userId/approve',
  [
    param('userId').isUUID(),
    body('approved').isBoolean(),
    body('reason').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const input = approveUserSchema.parse(req.body);
      const tenantId = req.tenantId!;
      const adminId = req.userId!;

      const user = await tenantAdminService.approveUser(
        userId,
        tenantId,
        input.approved,
        adminId,
        input.reason
      );

      res.json({
        message: input.approved
          ? 'User approved successfully'
          : 'User rejected successfully',
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// PUT /api/v1/tenant-admin/users/:userId/permissions - Update user permissions
router.put(
  '/users/:userId/permissions',
  [
    param('userId').isUUID(),
    body('permissions').isObject(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const input = updatePermissionsSchema.parse(req.body);
      const tenantId = req.tenantId!;
      const adminId = req.userId!;

      const user = await tenantAdminService.updateUserPermissions(
        userId,
        tenantId,
        input.permissions,
        adminId
      );

      res.json({
        message: 'User permissions updated successfully',
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// PUT /api/v1/tenant-admin/users/:userId/role - Update user role
router.put(
  '/users/:userId/role',
  [
    param('userId').isUUID(),
    body('role').isIn(['supplier_admin', 'supplier_staff', 'company_admin', 'company_staff']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const input = updateRoleSchema.parse(req.body);
      const tenantId = req.tenantId!;
      const adminId = req.userId!;

      const user = await tenantAdminService.updateUserRole(
        userId,
        tenantId,
        input.role as any,
        adminId
      );

      res.json({
        message: 'User role updated successfully',
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// PUT /api/v1/tenant-admin/users/:userId/status - Activate or deactivate user
router.put(
  '/users/:userId/status',
  [
    param('userId').isUUID(),
    body('isActive').isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { isActive } = req.body;
      const tenantId = req.tenantId!;
      const adminId = req.userId!;

      const user = await tenantAdminService.toggleUserStatus(
        userId,
        tenantId,
        isActive,
        adminId
      );

      res.json({
        message: isActive
          ? 'User activated successfully'
          : 'User deactivated successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/tenant-admin/users/:userId/assign-role - Assign role-based permissions (view/create/admin)
router.put(
  '/users/:userId/assign-role',
  [
    param('userId').isUUID(),
    body('roleType').isIn(['view', 'create', 'admin']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { roleType } = req.body;
      const tenantId = req.tenantId!;
      const adminId = req.userId!;

      const user = await tenantAdminService.assignRolePermissions(
        userId,
        tenantId,
        roleType,
        adminId
      );

      res.json({
        message: `User role set to ${roleType} successfully`,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// GET /api/v1/tenant-admin/statistics - Get tenant statistics
router.get(
  '/statistics',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const stats = await tenantAdminService.getTenantStatistics(tenantId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

export default router;



