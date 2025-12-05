import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole, TenantType, TenantStatus, UserStatus } from '@prisma/client';
import { createTestApp } from '../setup/appSetup';
import { setupTestDatabase, cleanTestDatabase, getTestPrisma, closeTestDatabase } from '../setup/testSetup';
import { createTestSuperAdmin, createTestTenant, createTestTenantAdmin } from '../helpers/authHelpers';
import { randomEmail, getErrorMessage } from '../helpers/testHelpers';

describe('Auth Routes Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let superAdmin: any;
  let supplierTenant: any;
  let companyTenant: any;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-integration-tests';

    // Setup database
    await setupTestDatabase();
    prisma = getTestPrisma();

    // Create test app
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanTestDatabase();

    // Create test data
    superAdmin = await createTestSuperAdmin(prisma);
    supplierTenant = await createTestTenant(prisma, {
      type: TenantType.supplier,
      status: TenantStatus.active,
    });
    companyTenant = await createTestTenant(prisma, {
      type: TenantType.company,
      status: TenantStatus.active,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new supplier tenant', async () => {
      const email = randomEmail();
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          registrationType: 'new_supplier',
          tenantName: 'Test Supplier',
          tenantType: 'supplier',
          email,
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          address: '123 Test St',
          postalCode: '12345',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(email);
      expect(response.body.user.role).toBe(UserRole.supplier_admin);

      // Verify user was created with pending status
      const user = await prisma.user.findUnique({
        where: { email },
      });
      expect(user).toBeTruthy();
      expect(user?.status).toBe(UserStatus.pending);
    });

    it('should register a new company tenant', async () => {
      const email = randomEmail();
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          registrationType: 'new_company',
          tenantName: 'Test Company',
          tenantType: 'company',
          email,
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890',
          address: '456 Test Ave',
          postalCode: '67890',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe(UserRole.company_admin);
    });

    it('should fail with duplicate email', async () => {
      const email = superAdmin.email;

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          registrationType: 'new_supplier',
          tenantName: 'Test Supplier',
          tenantType: 'supplier',
          email,
          password: 'password123',
          phone: '+1234567890',
          address: '123 Test St',
          postalCode: '12345',
        });

      expect(response.status).toBe(409);
      expect(getErrorMessage(response)).toContain('already registered');
    });

    it('should fail with invalid registration type', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          registrationType: 'invalid_type',
          email: randomEmail(),
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          registrationType: 'new_supplier',
          tenantName: 'Test Supplier',
          tenantType: 'supplier',
          email: randomEmail(),
          password: 'short',
          phone: '+1234567890',
          address: '123 Test St',
          postalCode: '12345',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login super admin successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdmin.email,
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.user.role).toBe(UserRole.super_admin);
      expect(response.body.user.tenantId).toBeNull();
    });

    it('should login tenant admin successfully', async () => {
      const tenantAdmin = await createTestTenantAdmin(prisma, supplierTenant.id, {
        email: 'admin@supplier.test.com',
        password: 'password123',
        tenantType: TenantType.supplier,
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: tenantAdmin.email,
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.role).toBe(UserRole.supplier_admin);
      expect(response.body.user.tenantId).toBe(supplierTenant.id);
    });

    it('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdmin.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(getErrorMessage(response)).toContain('Invalid email or password');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
    });

    it('should fail with inactive user', async () => {
      const tenantAdmin = await createTestTenantAdmin(prisma, supplierTenant.id, {
        email: 'inactive@supplier.test.com',
        password: 'password123',
        status: UserStatus.pending,
        tenantType: TenantType.supplier,
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: tenantAdmin.email,
          password: 'password123',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toContain('pending approval');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should get current super admin user', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(superAdmin.email);
      expect(response.body.role).toBe(UserRole.super_admin);
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/tenants', () => {
    it('should get all active tenants', async () => {
      const response = await request(app).get('/api/v1/auth/tenants');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenants');
      expect(Array.isArray(response.body.tenants)).toBe(true);
      expect(response.body.tenants.length).toBeGreaterThan(0);
    });

    it('should filter tenants by type', async () => {
      const response = await request(app)
        .get('/api/v1/auth/tenants')
        .query({ type: 'supplier' });

      expect(response.status).toBe(200);
      expect(response.body.tenants.every((t: any) => t.type === 'supplier')).toBe(true);
    });
  });
});


