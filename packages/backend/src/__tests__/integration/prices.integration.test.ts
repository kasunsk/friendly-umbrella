import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, TenantType, TenantStatus, UserRole } from '@prisma/client';
import { createTestApp } from '../setup/appSetup';
import { setupTestDatabase, cleanTestDatabase, getTestPrisma, closeTestDatabase } from '../setup/testSetup';
import { createTestTenant, createTestTenantAdmin } from '../helpers/authHelpers';
import { getErrorMessage, randomString } from '../helpers/testHelpers';

describe('Price Routes Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let supplierTenant: any;
  let supplierAdmin: any;
  let companyTenant: any;
  let companyAdmin: any;
  let productId: string;

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

    supplierTenant = await createTestTenant(prisma, {
      type: TenantType.supplier,
      status: TenantStatus.active,
    });

    supplierAdmin = await createTestTenantAdmin(prisma, supplierTenant.id, {
      email: 'admin@supplier.test.com',
      password: 'password123',
      role: UserRole.supplier_admin,
      tenantType: TenantType.supplier,
    });

    companyTenant = await createTestTenant(prisma, {
      type: TenantType.company,
      status: TenantStatus.active,
    });

    companyAdmin = await createTestTenantAdmin(prisma, companyTenant.id, {
      email: 'admin@company.test.com',
      password: 'password123',
      role: UserRole.company_admin,
      tenantType: TenantType.company,
    });

    // Create a test product
    const product = await prisma.product.create({
      data: {
        supplierId: supplierTenant.id,
        sku: `SKU-${randomString(8)}`,
        name: 'Test Product',
        unit: 'kg',
        isActive: true,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('PUT /api/v1/products/:id/default-price', () => {
    it('should update default price for supplier', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}/default-price`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          price: 99.99,
          currency: 'USD',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('price');
      expect(response.body.price).toBe(99.99);
    });

    it('should fail if not a supplier', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}/default-price`)
        .set('Authorization', `Bearer ${companyAdmin.accessToken}`)
        .send({
          price: 99.99,
          currency: 'USD',
        });

      expect(response.status).toBe(403);
    });

    it('should fail with invalid price', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}/default-price`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          price: -10,
          currency: 'USD',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/products/:id/private-prices', () => {
    it('should create private price for company', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/private-prices`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          companyId: companyTenant.id,
          price: 85.50,
          currency: 'USD',
          notes: 'Volume discount',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('price');
      expect(response.body.price).toBe(85.50);
    });

    it('should create private price with discount percentage', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/private-prices`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          companyId: companyTenant.id,
          discountPercentage: 15,
          currency: 'USD',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('discountPercentage');
      expect(response.body.discountPercentage).toBe(15);
    });

    it('should fail if both price and discount provided', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/private-prices`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          companyId: companyTenant.id,
          price: 85.50,
          discountPercentage: 15,
          currency: 'USD',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/products/:id/private-prices/:priceId', () => {
    let privatePriceId: string;

    beforeEach(async () => {
      // First create a default price
      await prisma.defaultPrice.create({
        data: {
          productId,
          price: 100,
          currency: 'USD',
          isActive: true,
        },
      });

      // Create a private price
      const privatePrice = await prisma.privatePrice.create({
        data: {
          productId,
          companyId: companyTenant.id,
          price: 90,
          currency: 'USD',
          isActive: true,
        },
      });
      privatePriceId = privatePrice.id;
    });

    it('should update private price', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}/private-prices/${privatePriceId}`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          price: 80,
          currency: 'USD',
        });

      expect(response.status).toBe(200);
      expect(response.body.price).toBe(80);
    });
  });

  describe('GET /api/v1/products/search', () => {
    beforeEach(async () => {
      // Create product with price for company to search
      await prisma.defaultPrice.create({
        data: {
          productId,
          price: 100,
          currency: 'USD',
          isActive: true,
        },
      });
    });

    it('should search products for company', async () => {
      const response = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'Test' })
        .set('Authorization', `Bearer ${companyAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('should filter by supplier', async () => {
      const response = await request(app)
        .get('/api/v1/products/search')
        .query({ supplierId: supplierTenant.id })
        .set('Authorization', `Bearer ${companyAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products).toBeDefined();
    });
  });

  describe('GET /api/v1/products/:id/price', () => {
    beforeEach(async () => {
      await prisma.defaultPrice.create({
        data: {
          productId,
          price: 100,
          currency: 'USD',
          isActive: true,
        },
      });
    });

    it('should get product price for company', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${productId}/price`)
        .set('Authorization', `Bearer ${companyAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('price');
      expect(response.body.price).toBe(100);
    });
  });
});


