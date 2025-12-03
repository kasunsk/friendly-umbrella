import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

const router = Router();

const registerSchema = z.object({
  registrationType: z.enum(['new_company', 'new_supplier', 'new_company_user', 'new_supplier_user']),
  tenantName: z.string().min(1).optional(),
  tenantType: z.enum(['supplier', 'company']).optional(),
  tenantId: z.string().uuid().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  role: z.string().optional(),
  permissions: z.record(z.any()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// GET /api/v1/auth/tenants - Get active tenants for registration
router.get('/auth/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantType = req.query.type as 'supplier' | 'company' | undefined;

    const where: any = {
      status: 'active',
      isActive: true,
    };

    if (tenantType) {
      where.type = tenantType;
    }

    const tenants = await prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ tenants });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/register
router.post(
  '/auth/register',
  [
    body('registrationType')
      .isIn(['new_company', 'new_supplier', 'new_company_user', 'new_supplier_user'])
      .withMessage('Invalid registration type'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = registerSchema.parse(req.body);
      
      // Validate required fields based on registration type
      if ((input.registrationType === 'new_company' || input.registrationType === 'new_supplier')) {
        if (!input.tenantName) {
          return res.status(400).json({ errors: [{ msg: 'Tenant name is required' }] });
        }
        if (!input.tenantType) {
          return res.status(400).json({ errors: [{ msg: 'Tenant type is required' }] });
        }
        if (!input.phone) {
          return res.status(400).json({ errors: [{ msg: 'Phone number is required' }] });
        }
        if (!input.address) {
          return res.status(400).json({ errors: [{ msg: 'Address is required' }] });
        }
        if (!input.postalCode) {
          return res.status(400).json({ errors: [{ msg: 'Postal code is required' }] });
        }
      } else {
        if (!input.tenantId) {
          return res.status(400).json({ errors: [{ msg: 'Tenant selection is required' }] });
        }
      }

      const result = await authService.register(input);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/auth/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get('/auth/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.userId!);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };


