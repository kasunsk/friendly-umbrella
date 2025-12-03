import { prisma } from '../utils/prisma';
import createError from 'http-errors';
import { Decimal } from '@prisma/client/runtime/library';

export interface SpecialPriceInput {
  companyId: string;
  price?: number; // Optional if discountPercentage is provided
  discountPercentage?: number; // Optional if price is provided (0-100)
  currency?: string;
  notes?: string;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  defaultPrice?: number;
  currency?: string;
  specialPrices?: SpecialPriceInput[];
  metadata?: Record<string, any>;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
  specialPrices?: SpecialPriceInput[]; // Optional: add/update special prices
}

export class ProductService {
  /**
   * Get all products for a supplier
   */
  async getSupplierProducts(supplierId: string, includeInactive = false, page = 1, limit = 20) {
    const where: any = {
      supplierId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          defaultPrices: {
            where: { isActive: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              privatePrices: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single product by ID (supplier only)
   */
  async getProductById(productId: string, supplierId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        supplierId,
      },
      include: {
        defaultPrices: {
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        },
        privatePrices: {
          where: { isActive: true },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!product) {
      throw createError(404, 'Product not found');
    }

    return product;
  }

  /**
   * Create a new product
   */
  async createProduct(supplierId: string, input: CreateProductInput) {
    // Check if SKU already exists for this supplier
    const existing = await prisma.product.findUnique({
      where: {
        supplierId_sku: {
          supplierId,
          sku: input.sku,
        },
      },
    });

    if (existing) {
      throw createError(409, `Product with SKU "${input.sku}" already exists`);
    }

    // Create product with optional default price in transaction
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          supplierId,
          sku: input.sku,
          name: input.name,
          description: input.description,
          category: input.category,
          unit: input.unit,
          metadata: input.metadata || {},
          isActive: true,
        },
      });

      // Create default price if provided
      if (input.defaultPrice !== undefined) {
        await tx.defaultPrice.create({
          data: {
            productId: product.id,
            price: new Decimal(input.defaultPrice),
            currency: input.currency || 'USD',
            isActive: true,
          },
        });
      }

      // Create special prices if provided
      if (input.specialPrices && input.specialPrices.length > 0) {
        // Check for duplicate company IDs
        const companyIds = input.specialPrices.map((sp) => sp.companyId);
        const uniqueCompanyIds = new Set(companyIds);
        if (companyIds.length !== uniqueCompanyIds.size) {
          throw createError(400, 'Duplicate company IDs found in special prices');
        }

        // Verify all companies exist and are active
        const companies = await tx.tenant.findMany({
          where: {
            id: { in: Array.from(uniqueCompanyIds) },
            type: 'company',
            isActive: true,
          },
        });

        if (companies.length !== uniqueCompanyIds.size) {
          throw createError(400, 'One or more companies not found or inactive');
        }

        // Get default price currency if it exists (for discount percentage)
        const defaultPriceCurrency = input.currency || 'USD';
        if (input.defaultPrice !== undefined) {
          // We already know the currency from input.currency
        }

        // Create private prices for each company
        for (const specialPrice of input.specialPrices) {
          // Validate: either price OR discountPercentage must be provided, but not both
          if ((!specialPrice.price && !specialPrice.discountPercentage) || 
              (specialPrice.price && specialPrice.discountPercentage)) {
            throw createError(400, 'Each special price must have either price or discountPercentage, but not both');
          }

          // Validate discountPercentage range (0-100)
          if (specialPrice.discountPercentage !== undefined) {
            if (specialPrice.discountPercentage < 0 || specialPrice.discountPercentage > 100) {
              throw createError(400, 'Discount percentage must be between 0 and 100');
            }
          }

          // For discount percentage, use the product's default currency if currency not provided
          let finalCurrency = specialPrice.currency || input.currency || 'USD';
          if (specialPrice.discountPercentage !== undefined && !specialPrice.currency) {
            // When using discount percentage without explicit currency, use product's default currency
            finalCurrency = defaultPriceCurrency;
          }

          await tx.privatePrice.create({
            data: {
              productId: product.id,
              companyId: specialPrice.companyId,
              price: specialPrice.price ? new Decimal(specialPrice.price) : null,
              discountPercentage: specialPrice.discountPercentage !== undefined 
                ? new Decimal(specialPrice.discountPercentage) 
                : null,
              currency: finalCurrency,
              notes: specialPrice.notes,
              isActive: true,
            },
          });
        }
      }

      // Return product with default price
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          defaultPrices: {
            where: { isActive: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      });
    });
  }

  /**
   * Update a product
   */
  async updateProduct(productId: string, supplierId: string, input: UpdateProductInput) {
    // Verify product belongs to supplier
    const existing = await prisma.product.findFirst({
      where: {
        id: productId,
        supplierId,
      },
      include: {
        defaultPrices: {
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw createError(404, 'Product not found');
    }

    // Check SKU uniqueness if SKU is being updated
    if (input.sku && input.sku !== existing.sku) {
      const skuExists = await prisma.product.findUnique({
        where: {
          supplierId_sku: {
            supplierId,
            sku: input.sku,
          },
        },
      });

      if (skuExists) {
        throw createError(409, `Product with SKU "${input.sku}" already exists`);
      }
    }

    // Get default price currency for discount percentage calculations
    const defaultPriceCurrency = existing.defaultPrices[0]?.currency || 'USD';

    // Update product and handle special prices in transaction
    return prisma.$transaction(async (tx) => {
      // Update product basic info
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          ...(input.sku && { sku: input.sku }),
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.unit && { unit: input.unit }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
      });

      // Handle special prices if provided
      if (input.specialPrices && input.specialPrices.length > 0) {
        // Check for duplicate company IDs
        const companyIds = input.specialPrices.map((sp) => sp.companyId);
        const uniqueCompanyIds = new Set(companyIds);
        if (companyIds.length !== uniqueCompanyIds.size) {
          throw createError(400, 'Duplicate company IDs found in special prices');
        }

        // Verify all companies exist and are active
        const companies = await tx.tenant.findMany({
          where: {
            id: { in: Array.from(uniqueCompanyIds) },
            type: 'company',
            isActive: true,
          },
        });

        if (companies.length !== uniqueCompanyIds.size) {
          throw createError(400, 'One or more companies not found or inactive');
        }

        // Process each special price
        for (const specialPrice of input.specialPrices) {
          // Validate: either price OR discountPercentage must be provided, but not both
          if ((!specialPrice.price && !specialPrice.discountPercentage) || 
              (specialPrice.price && specialPrice.discountPercentage)) {
            throw createError(400, 'Each special price must have either price or discountPercentage, but not both');
          }

          // Validate discountPercentage range (0-100)
          if (specialPrice.discountPercentage !== undefined) {
            if (specialPrice.discountPercentage < 0 || specialPrice.discountPercentage > 100) {
              throw createError(400, 'Discount percentage must be between 0 and 100');
            }
          }

          // For discount percentage, use the product's default currency if currency not provided
          let finalCurrency = specialPrice.currency || defaultPriceCurrency;
          if (specialPrice.discountPercentage !== undefined && !specialPrice.currency) {
            finalCurrency = defaultPriceCurrency;
          }

          // Check if a private price already exists for this company and product
          const existingPrivatePrice = await tx.privatePrice.findFirst({
            where: {
              productId: product.id,
              companyId: specialPrice.companyId,
              isActive: true,
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          if (existingPrivatePrice) {
            // Deactivate the old price
            await tx.privatePrice.update({
              where: { id: existingPrivatePrice.id },
              data: { isActive: false },
            });
          }

          // Create new private price entry
          await tx.privatePrice.create({
            data: {
              productId: product.id,
              companyId: specialPrice.companyId,
              price: specialPrice.price ? new Decimal(specialPrice.price) : null,
              discountPercentage: specialPrice.discountPercentage !== undefined 
                ? new Decimal(specialPrice.discountPercentage) 
                : null,
              currency: finalCurrency,
              notes: specialPrice.notes,
              isActive: true,
            },
          });
        }
      }

      // Return updated product with default price
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          defaultPrices: {
            where: { isActive: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      });
    });
  }

  /**
   * Delete a product (soft delete by setting isActive to false)
   */
  async deleteProduct(productId: string, supplierId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        supplierId,
      },
    });

    if (!product) {
      throw createError(404, 'Product not found');
    }

    // Soft delete
    return prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  }

  /**
   * Get product statistics for supplier dashboard
   */
  async getSupplierStats(supplierId: string) {
    const [totalProducts, activeProducts, productsWithPrices, productsWithPrivatePrices] =
      await Promise.all([
        prisma.product.count({
          where: { supplierId },
        }),
        prisma.product.count({
          where: { supplierId, isActive: true },
        }),
        prisma.product.count({
          where: {
            supplierId,
            isActive: true,
            defaultPrices: {
              some: { isActive: true },
            },
          },
        }),
        prisma.product.count({
          where: {
            supplierId,
            isActive: true,
            privatePrices: {
              some: { isActive: true },
            },
          },
        }),
      ]);

    return {
      totalProducts,
      activeProducts,
      productsWithPrices,
      productsWithPrivatePrices,
    };
  }
}

export const productService = new ProductService();









