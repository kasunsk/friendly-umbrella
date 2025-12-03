import { Router, Response, NextFunction } from 'express';
import { productService } from '../services/productService';
import { authenticate, AuthRequest, requireRole, requireTenantType, requireTenantAdmin } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import { z } from 'zod';

// Define schemas locally since @platform/shared might not be resolved
const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  defaultPrice: z.number().min(0, 'Price must be positive').optional(),
});

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireTenantType('supplier'));

const specialPriceSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  price: z.number().min(0, 'Price must be positive').optional(),
  discountPercentage: z.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    // Either price or discountPercentage must be provided, but not both
    const hasPrice = data.price !== undefined;
    const hasDiscount = data.discountPercentage !== undefined;
    return (hasPrice || hasDiscount) && !(hasPrice && hasDiscount);
  },
  {
    message: 'Either price or discountPercentage must be provided, but not both',
    path: ['price'],
  }
);

const createProductSchema = productSchema.extend({
  defaultPrice: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  specialPrices: z.array(specialPriceSchema).optional(),
});

const updateProductSchema = productSchema.partial().extend({
  isActive: z.boolean().optional(),
  specialPrices: z.array(specialPriceSchema).optional(),
});

// GET /api/v1/products - List all products for supplier
router.get(
  '/products',
  [
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const includeInactive = req.query.includeInactive === 'true';
      const products = await productService.getSupplierProducts(
        req.tenantId!,
        includeInactive
      );

      res.json({ products });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/products/stats - Get supplier statistics
router.get('/products/stats', async (req: AuthRequest, res, next) => {
  try {
    const stats = await productService.getSupplierStats(req.tenantId!);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/products/:id - Get single product
router.get(
  '/products/:id',
  [param('id').isUUID().withMessage('Invalid product ID')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = await productService.getProductById(
        req.params.id,
        req.tenantId!
      );
      res.json({ product });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/products - Create product
router.post(
  '/products',
  [
    body('sku').notEmpty().withMessage('SKU is required'),
    body('name').notEmpty().withMessage('Product name is required'),
    body('unit').notEmpty().withMessage('Unit is required'),
    body('defaultPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Default price must be a positive number'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = createProductSchema.parse(req.body);
      const product = await productService.createProduct(req.tenantId!, input);

      res.status(201).json({ product });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// PUT /api/v1/products/:id - Update product
router.put(
  '/products/:id',
  [
    param('id').isUUID().withMessage('Invalid product ID'),
    body('sku').optional().notEmpty().withMessage('SKU cannot be empty'),
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const input = updateProductSchema.parse(req.body);
      const product = await productService.updateProduct(
        req.params.id,
        req.tenantId!,
        input
      );

      res.json({ product });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  }
);

// DELETE /api/v1/products/:id - Delete product (soft delete) - Admin only
router.delete(
  '/products/:id',
  requireTenantAdmin(), // Only supplier admin can delete products
  [param('id').isUUID().withMessage('Invalid product ID')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      await productService.deleteProduct(req.params.id, req.tenantId!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export { router as productRoutes };


