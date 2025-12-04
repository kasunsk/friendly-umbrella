import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, TenantType, TenantStatus, UserRole, UserStatus } from '@prisma/client';
import { createTestApp } from '../setup/appSetup';
import { setupTestDatabase, cleanTestDatabase, getTestPrisma, closeTestDatabase } from '../setup/testSetup';
import { createTestTenant, createTestTenantAdmin, createTestStaff } from '../helpers/authHelpers';
import { getErrorMessage, randomEmail } from '../helpers/testHelpers';

describe('Tenant Admin Routes Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let supplierTenant: any;
  let supplierAdmin: any;
  let companyTenant: any;
  let companyAdmin: any;
  let pendingUser: any;

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
    });

    companyTenant = await createTestTenant(prisma, {
      type: TenantType.company,
      status: TenantStatus.active,
    });

    companyAdmin = await createTestTenantAdmin(prisma, companyTenant.id, {
      email: 'admin@company.test.com',
      password: 'password123',
      role: UserRole.company_admin,
    });

    // Create a pending user
    pendingUser = await createTestStaff(prisma, supplierTenant.id, {
      email: 'pending@supplier.test.com',
      password: 'password123',
      role: UserRole.supplier_staff,
      status: UserStatus.pending,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('GET /api/v1/tenant-admin/users/pending', () => {
    it('should get pending users for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/users/pending')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should only return users from the same tenant', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/users/pending')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every((u: any) => u.tenantId === supplierTenant.id)).toBe(true);
    });
  });

  describe('GET /api/v1/tenant-admin/users', () => {
    beforeEach(async () => {
      // Create additional users
      await createTestStaff(prisma, supplierTenant.id, {
        email: 'active@supplier.test.com',
        password: 'password123',
        status: UserStatus.active,
      });
    });

    it('should get all users for tenant', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/users')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should filter users by status', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/users')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every((u: any) => u.status === 'pending')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/users')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('POST /api/v1/tenant-admin/users', () => {
    it('should create a new user (pending)', async () => {
      const email = randomEmail();
      const response = await request(app)
        .post('/api/v1/tenant-admin/users')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          email,
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: 'supplier_staff',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(email);
      expect(response.body.user.status).toBe('pending');

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { email },
      });
      expect(user).toBeTruthy();
      expect(user?.status).toBe(UserStatus.pending);
    });

    it('should fail with duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/tenant-admin/users')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          email: supplierAdmin.email,
          password: 'password123',
          role: 'supplier_staff',
        });

      expect(response.status).toBe(409);
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/tenant-admin/users')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          email: randomEmail(),
          password: 'short',
          role: 'supplier_staff',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/tenant-admin/users/:userId/approve', () => {
    it('should approve a pending user', async () => {
      const response = await request(app)
        .post(`/api/v1/tenant-admin/users/${pendingUser.id}/approve`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          approved: true,
          reason: 'User verified',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe('active');

      // Verify user was activated
      const updated = await prisma.user.findUnique({
        where: { id: pendingUser.id },
      });
      expect(updated?.status).toBe(UserStatus.active);
      expect(updated?.isActive).toBe(true);
    });

    it('should reject a pending user', async () => {
      const response = await request(app)
        .post(`/api/v1/tenant-admin/users/${pendingUser.id}/approve`)
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`)
        .send({
          approved: false,
          reason: 'Incomplete profile',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe('rejected');
    });
  });

  describe('GET /api/v1/tenant-admin/statistics', () => {
    beforeEach(async () => {
      // Create additional users for statistics
      await createTestStaff(prisma, supplierTenant.id, {
        email: 'user1@supplier.test.com',
        password: 'password123',
        status: UserStatus.active,
      });
      await createTestStaff(prisma, supplierTenant.id, {
        email: 'user2@supplier.test.com',
        password: 'password123',
        status: UserStatus.pending,
      });
    });

    it('should get tenant statistics', async () => {
      const response = await request(app)
        .get('/api/v1/tenant-admin/statistics')
        .set('Authorization', `Bearer ${supplierAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalUsers');
      expect(typeof response.body.totalUsers).toBe('number');
    });
  });
});


