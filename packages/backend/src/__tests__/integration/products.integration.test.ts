import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, TenantType, TenantStatus, UserRole } from '@prisma/client';
import { createTestApp } from '../setup/appSetup';
import { setupTestDatabase, cleanTestDatabase, getTestPrisma, closeTestDatabase } from '../setup/testSetup';
import { createTestTenant, createTestTenantAdmin, createTestTenantWithAdmin } from '../helpers/authHelpers';
import { getErrorMessage, randomString } from '../helpers/testHelpers';

describe('Product Routes Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let supplierTenant: any;
  let supplierAdmin: any;
  let companyTenant: any;
  let companyAdmin: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-integration-tests';

    await setupTestDatabase();
    prisma = getTestPrisma();
    app = createTestApp();
  });

  beforeEach(async () => {
    await cleanTestDatabase();

    // Create supplier tenant with admin in a single transaction
    const supplierData = await createTestTenantWithAdmin(prisma, {
      type: TenantType.supplier,
      status: TenantStatus.active,
    }, {
      email: 'admin@supplier.test.com',
      password: 'password123',
      role: UserRole.supplier_admin,
    });
    supplierTenant = supplierData.tenant;
    supplierAdmin = supplierData.admin;

    // Create company tenant with admin in a single transaction
    const companyData = await createTestTenantWithAdmin(prisma, {
      type: TenantType.company,
      status: TenantStatus.active,
    }, {
      email: 'admin@company.test.com',
      password: 'password123',
      role: UserRole.company_admin,
    });
    companyTenant = companyData.tenant;
    companyAdmin = companyData.admin;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/v1/products', () => {
    it('should create a product for supplier', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          sku: `SKU-${randomString(8)}`,
          name: 'Test Product',
          description: 'Test Description',
          category: 'Materials',
          unit: 'kg',
          defaultPrice: 100.50,
          currency: 'USD',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('product');
      expect(response.body.product.name).toBe('Test Product');
      expect(response.body.product.sku).toBeDefined();
    });

    it('should fail if not authenticated', async () => {
      const response = await request(app).post('/api/v1/products').send({
        sku: 'TEST-SKU',
        name: 'Test Product',
        unit: 'kg',
      });

      expect(response.status).toBe(401);
    });

    it('should fail if not a supplier', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${companyAdmin.accessToken}`)
        .send({
          sku: 'TEST-SKU',
          name: 'Test Product',
          unit: 'kg',
        });

      expect(response.status).toBe(403);
    });

    it('should fail with invalid data', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          // Missing required fields
          name: 'Test Product',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/products', () => {
    beforeEach(async () => {
      // Create some test products
      await prisma.product.createMany({
        data: [
          {
            supplierId: supplierTenant.id,
            sku: 'PROD-1',
            name: 'Product 1',
            unit: 'kg',
            isActive: true,
          },
          {
            supplierId: supplierTenant.id,
            sku: 'PROD-2',
            name: 'Product 2',
            unit: 'piece',
            isActive: true,
          },
          {
            supplierId: supplierTenant.id,
            sku: 'PROD-3',
            name: 'Inactive Product',
            unit: 'kg',
            isActive: false,
          },
        ],
      });
    });

    it('should get all active products for supplier', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.products.length).toBe(2); // Only active products
    });

    it('should include inactive products when requested', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({ includeInactive: 'true' })
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products.length).toBe(3); // All products
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products.length).toBe(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          supplierId: supplierTenant.id,
          sku: 'TEST-SKU',
          name: 'Test Product',
          description: 'Test Description',
          unit: 'kg',
          isActive: true,
        },
      });
      productId = product.id;
    });

    it('should get product by id', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.product.id).toBe(productId);
      expect(response.body.product.name).toBe('Test Product');
    });

    it('should fail if product not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/products/${fakeId}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          supplierId: supplierTenant.id,
          sku: 'TEST-SKU',
          name: 'Original Product',
          unit: 'kg',
          isActive: true,
        },
      });
      productId = product.id;
    });

    it('should update product', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          name: 'Updated Product Name',
          description: 'Updated Description',
        });

      expect(response.status).toBe(200);
      expect(response.body.product.name).toBe('Updated Product Name');
    });

    it('should fail if product belongs to different tenant', async () => {
      // Create product for different tenant
      const otherTenant = await createTestTenant(prisma, {
        type: TenantType.supplier,
        status: TenantStatus.active,
      });

      const otherProduct = await prisma.product.create({
        data: {
          supplierId: otherTenant.id,
          sku: 'OTHER-SKU',
          name: 'Other Product',
          unit: 'kg',
          isActive: true,
        },
      });

      const response = await request(app)
        .put(`/api/v1/products/${otherProduct.id}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          supplierId: supplierTenant.id,
          sku: 'DELETE-SKU',
          name: 'Product to Delete',
          unit: 'kg',
          isActive: true,
        },
      });
      productId = product.id;
    });

    it('should delete product', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(204);

      // Verify product is deleted
      const deleted = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('GET /api/v1/products/stats', () => {
    beforeEach(async () => {
      await prisma.product.createMany({
        data: [
          {
            supplierId: supplierTenant.id,
            sku: 'PROD-1',
            name: 'Product 1',
            unit: 'kg',
            isActive: true,
          },
          {
            supplierId: supplierTenant.id,
            sku: 'PROD-2',
            name: 'Product 2',
            unit: 'piece',
            isActive: true,
          },
        ],
      });
    });

    it('should get supplier statistics', async () => {
      const response = await request(app)
        .get('/api/v1/products/stats')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalProducts');
      expect(response.body.totalProducts).toBe(2);
    });
  });
});


