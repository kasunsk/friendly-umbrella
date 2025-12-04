import { Router, Response, NextFunction } from 'express';
import { superAdminService } from '../services/superAdminService';
import { authenticate, AuthRequest, requireSuperAdmin } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import { z } from 'zod';

const router = Router();

const approveTenantSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

const createSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Apply authentication and super admin check to all routes
router.use(authenticate, requireSuperAdmin());

// GET /api/v1/admin/tenants/pending - Get all pending tenant requests
router.get(
  '/tenants/pending',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenants = await superAdminService.getPendingTenants();
      res.json({ tenants });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/admin/tenants - Get all tenants (with optional status and type filter)
router.get(
  '/tenants',
  [
    query('status').optional().isIn(['pending', 'active', 'rejected']),
    query('type').optional().isIn(['company', 'supplier']),
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

      const status = req.query.status as 'pending' | 'active' | 'rejected' | undefined;
      const type = req.query.type as 'company' | 'supplier' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await superAdminService.getAllTenants(status, type, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/admin/tenants/:tenantId/approve - Approve or reject a tenant
router.post(
  '/tenants/:tenantId/approve',
  [
    param('tenantId').isUUID(),
    body('approved').isBoolean(),
    body('reason').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tenantId } = req.params;
      const input = approveTenantSchema.parse(req.body);
      const superAdminId = req.userId!;

      const tenant = await superAdminService.approveTenant(
        tenantId,
        input.approved,
        superAdminId,
        input.reason
      );

      res.json({
        message: input.approved
          ? 'Tenant approved successfully'
          : 'Tenant rejected successfully',
        tenant,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// GET /api/v1/admin/super-admins - Get all super admins
router.get(
  '/super-admins',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const admins = await superAdminService.getSuperAdmins();
      res.json({ admins });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/admin/super-admins - Create a new super admin
router.post(
  '/super-admins',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = createSuperAdminSchema.parse(req.body);
      const createdBy = req.userId!;

      const superAdmin = await superAdminService.createSuperAdmin(input, createdBy);

      res.status(201).json({
        message: 'Super admin created successfully',
        superAdmin,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// PUT /api/v1/admin/tenants/:tenantId/toggle-status - Toggle tenant active status
router.put(
  '/tenants/:tenantId/toggle-status',
  [
    param('tenantId').isUUID(),
    body('isActive').isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tenantId } = req.params;
      const { isActive } = req.body;
      const superAdminId = req.userId!;

      const tenant = await superAdminService.toggleTenantStatus(tenantId, isActive, superAdminId);

      res.json({
        message: isActive ? 'Tenant activated successfully' : 'Tenant deactivated successfully',
        tenant,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/admin/statistics - Get system statistics
router.get(
  '/statistics',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await superAdminService.getStatistics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

export default router;





