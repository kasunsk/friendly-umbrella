import { prisma } from '../utils/prisma';
import createError from 'http-errors';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  defaultPrice?: number;
  currency?: string;
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
}

export class ProductService {
  /**
   * Get all products for a supplier
   */
  async getSupplierProducts(supplierId: string, includeInactive = false) {
    return prisma.product.findMany({
      where: {
        supplierId,
        ...(includeInactive ? {} : { isActive: true }),
      },
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
    });
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

    // Update product
    return prisma.product.update({
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
      include: {
        defaultPrices: {
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
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









