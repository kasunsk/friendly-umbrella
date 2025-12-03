import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { priceService } from '../services/priceService';
import { authenticate, AuthRequest, requireTenantType } from '../middleware/auth';
import { param, query, validationResult } from 'express-validator';
import createError from 'http-errors';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Apply tenant type check per route to avoid conflicts with productRoutes
const requireCompany = requireTenantType('company');

// GET /api/v1/suppliers - List all active suppliers
router.get('/suppliers', requireCompany, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const suppliers = await prisma.tenant.findMany({
      where: {
        type: 'supplier',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        _count: {
          select: {
            products: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ suppliers });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/suppliers/:id - Get supplier details
router.get(
  '/suppliers/:id',
  requireCompany,
  [param('id').isUUID().withMessage('Invalid supplier ID')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const supplier = await prisma.tenant.findFirst({
        where: {
          id: req.params.id,
          type: 'supplier',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!supplier) {
        throw createError(404, 'Supplier not found');
      }

      res.json({ supplier });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/suppliers/:id/products - Browse supplier catalog
router.get(
  '/suppliers/:id/products',
  requireCompany,
  [
    param('id').isUUID().withMessage('Invalid supplier ID'),
    query('category').optional().isString(),
    query('search').optional().isString(),
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

      const supplierId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;

      // Verify supplier exists
      const supplier = await prisma.tenant.findFirst({
        where: {
          id: supplierId,
          type: 'supplier',
          isActive: true,
        },
      });

      if (!supplier) {
        throw createError(404, 'Supplier not found');
      }

      // Build where clause
      const where: any = {
        supplierId,
        isActive: true,
      };

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get products with prices
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            defaultPrices: {
              where: {
                isActive: true,
                OR: [
                  { effectiveUntil: null },
                  { effectiveUntil: { gte: new Date() } },
                ],
              },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
        }),
        prisma.product.count({ where }),
      ]);

      // Get private prices for this company
      const productIds = products.map((p) => p.id);
      const privatePrices = await prisma.privatePrice.findMany({
        where: {
          productId: { in: productIds },
          companyId: req.tenantId!,
          isActive: true,
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // Create a map of private prices by product ID
      const privatePriceMap = new Map(
        privatePrices.map((pp) => [pp.productId, pp])
      );

      // Combine products with prices - return both default and private prices
      const productsWithPrices = products.map((product) => {
        const privatePrice = privatePriceMap.get(product.id);
        const defaultPrice = product.defaultPrices[0];

        // Calculate final price: use privatePrice if available, otherwise defaultPrice
        // If privatePrice has discountPercentage, calculate from defaultPrice
        let finalPrice: number | null = null;
        let finalCurrency: string | null = null;
        let discountPercentage: number | null = null;
        let calculatedPrice: number | null = null;

        if (privatePrice) {
          if (privatePrice.discountPercentage !== null && privatePrice.discountPercentage !== undefined && defaultPrice) {
            // Discount percentage is set, calculate price from default price
            discountPercentage = Number(privatePrice.discountPercentage);
            const defaultPriceValue = Number(defaultPrice.price);
            // Ensure discount percentage is treated as percentage (3 means 3%, not 0.03)
            calculatedPrice = defaultPriceValue * (1 - discountPercentage / 100);
            // Round to 2 decimal places for currency
            calculatedPrice = Math.round(calculatedPrice * 100) / 100;
            finalPrice = calculatedPrice;
            finalCurrency = privatePrice.currency || defaultPrice.currency;
          } else if (privatePrice.price !== null) {
            // Fixed price is set
            finalPrice = Number(privatePrice.price);
            finalCurrency = privatePrice.currency;
          }
        } else if (defaultPrice) {
          finalPrice = Number(defaultPrice.price);
          finalCurrency = defaultPrice.currency;
        }

        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          unit: product.unit,
          supplierId: product.supplierId,
          supplierName: supplier.name,
          // Return both prices for comparison
          defaultPrice: defaultPrice ? {
            price: Number(defaultPrice.price),
            currency: defaultPrice.currency,
          } : null,
          privatePrice: privatePrice ? {
            price: privatePrice.price ? Number(privatePrice.price) : null,
            discountPercentage: privatePrice.discountPercentage ? Number(privatePrice.discountPercentage) : null,
            calculatedPrice: calculatedPrice,
            currency: privatePrice.currency,
          } : null,
          // Keep backward compatibility - this is the price that applies
          price: finalPrice,
          priceType: privatePrice ? 'private' : defaultPrice ? 'default' : null,
          currency: finalCurrency,
        };
      });

      res.json({
        products: productsWithPrices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/products/:id/price - Get price for specific product (company view)
router.get(
  '/products/:id/price',
  requireCompany,
  [param('id').isUUID().withMessage('Invalid product ID')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const priceInfo = await priceService.getCompanyPrice(
        req.params.id,
        req.tenantId!
      );

      res.json({ price: priceInfo });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/products/search - Search products across all suppliers
router.get(
  '/products/search',
  requireCompany,
  [
    query('q').optional().isString().withMessage('Query must be a string'),
    query('category').optional().isString(),
    query('supplierId').optional().isUUID().withMessage('Invalid supplier ID'),
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

      const query = (req.query.q as string) || '';
      const category = req.query.category as string | undefined;
      const supplierId = req.query.supplierId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        isActive: true,
      };

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (category) {
        where.category = category;
      }

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ];
      }

      // Get products with suppliers and prices
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            defaultPrices: {
              where: {
                isActive: true,
                OR: [
                  { effectiveUntil: null },
                  { effectiveUntil: { gte: new Date() } },
                ],
              },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
        }),
        prisma.product.count({ where }),
      ]);

      // Get private prices for this company
      const productIds = products.map((p) => p.id);
      const privatePrices = await prisma.privatePrice.findMany({
        where: {
          productId: { in: productIds },
          companyId: req.tenantId!,
          isActive: true,
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // Create a map of private prices by product ID
      const privatePriceMap = new Map(
        privatePrices.map((pp) => [pp.productId, pp])
      );

      // Combine products with prices - return both default and private prices
      const productsWithPrices = products.map((product) => {
        const privatePrice = privatePriceMap.get(product.id);
        const defaultPrice = product.defaultPrices[0];

        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          unit: product.unit,
          supplierId: product.supplier.id,
          supplierName: product.supplier.name,
          // Return both prices for comparison
          defaultPrice: defaultPrice ? {
            price: Number(defaultPrice.price),
            currency: defaultPrice.currency,
          } : null,
          privatePrice: privatePrice ? {
            price: privatePrice.price ? Number(privatePrice.price) : null,
            discountPercentage: privatePrice.discountPercentage !== null && privatePrice.discountPercentage !== undefined 
              ? Number(privatePrice.discountPercentage) 
              : null,
            calculatedPrice: privatePrice.discountPercentage !== null && privatePrice.discountPercentage !== undefined && defaultPrice 
              ? Math.round(Number(defaultPrice.price) * (1 - Number(privatePrice.discountPercentage) / 100) * 100) / 100
              : null,
            currency: privatePrice.currency,
          } : null,
          // Keep backward compatibility - this is the price that applies
          price: privatePrice
            ? (privatePrice.discountPercentage && defaultPrice
                ? Number(defaultPrice.price) * (1 - Number(privatePrice.discountPercentage) / 100)
                : privatePrice.price
                  ? Number(privatePrice.price)
                  : null)
            : defaultPrice
            ? Number(defaultPrice.price)
            : null,
          priceType: privatePrice ? 'private' : defaultPrice ? 'default' : null,
          currency: privatePrice
            ? privatePrice.currency
            : defaultPrice
            ? defaultPrice.currency
            : null,
        };
      });

      res.json({
        products: productsWithPrices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/products/categories - Get all product categories
router.get('/products/categories', requireCompany, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.product.findMany({
      where: {
        isActive: true,
        category: { not: null },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    const categoryList = categories
      .map((c) => c.category)
      .filter((c): c is string => c !== null);

    res.json({ categories: categoryList });
  } catch (error) {
    next(error);
  }
});

export { router as supplierRoutes };









