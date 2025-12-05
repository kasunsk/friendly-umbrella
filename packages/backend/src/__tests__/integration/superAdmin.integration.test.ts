import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, TenantType, TenantStatus, UserRole, UserStatus } from '@prisma/client';
import { createTestApp } from '../setup/appSetup';
import { setupTestDatabase, cleanTestDatabase, getTestPrisma, closeTestDatabase } from '../setup/testSetup';
import { createTestSuperAdmin, createTestTenant, createTestTenantAdmin } from '../helpers/authHelpers';
import { getErrorMessage, randomEmail } from '../helpers/testHelpers';

describe('Super Admin Routes Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let superAdmin: any;
  let pendingTenant: any;
  let activeTenant: any;

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

    superAdmin = await createTestSuperAdmin(prisma);
    
    pendingTenant = await createTestTenant(prisma, {
      type: TenantType.supplier,
      status: TenantStatus.pending,
    });

    activeTenant = await createTestTenant(prisma, {
      type: TenantType.company,
      status: TenantStatus.active,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('GET /api/v1/admin/tenants/pending', () => {
    it('should get all pending tenants', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tenants/pending')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenants');
      expect(Array.isArray(response.body.tenants)).toBe(true);
      expect(response.body.tenants.length).toBeGreaterThan(0);
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/v1/admin/tenants/pending');

      expect(response.status).toBe(401);
    });

    it('should fail if not super admin', async () => {
      const tenantAdmin = await createTestTenantAdmin(prisma, activeTenant.id, {
        email: 'admin@test.com',
        password: 'password123',
        tenantType: TenantType.company,
      });

      const response = await request(app)
        .get('/api/v1/admin/tenants/pending')
        .set('Authorization', `Bearer ${tenantAdmin.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/tenants', () => {
    it('should get all tenants', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenants');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should filter tenants by status', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tenants')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tenants.every((t: any) => t.status === 'pending')).toBe(true);
    });

    it('should filter tenants by type', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tenants')
        .query({ type: 'supplier' })
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tenants.every((t: any) => t.type === 'supplier')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/admin/tenants')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tenants.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('POST /api/v1/admin/tenants/:tenantId/approve', () => {
    it('should approve a pending tenant', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/tenants/${pendingTenant.id}/approve`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          approved: true,
          reason: 'All documents verified',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('tenant');
      expect(response.body.tenant.status).toBe('active');

      // Verify tenant was activated
      const updated = await prisma.tenant.findUnique({
        where: { id: pendingTenant.id },
      });
      expect(updated?.status).toBe(TenantStatus.active);
      expect(updated?.isActive).toBe(true);
    });

    it('should reject a pending tenant', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/tenants/${pendingTenant.id}/approve`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          approved: false,
          reason: 'Incomplete documentation',
        });

      expect(response.status).toBe(200);
      expect(response.body.tenant.status).toBe('rejected');

      // Verify tenant was rejected
      const updated = await prisma.tenant.findUnique({
        where: { id: pendingTenant.id },
      });
      expect(updated?.status).toBe(TenantStatus.rejected);
    });

    it('should fail with invalid tenant ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/v1/admin/tenants/${fakeId}/approve`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          approved: true,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/admin/super-admins', () => {
    it('should create a new super admin', async () => {
      const email = randomEmail();
      const response = await request(app)
        .post('/api/v1/admin/super-admins')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          email,
          password: 'password123',
          firstName: 'New',
          lastName: 'Super Admin',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('superAdmin');
      expect(response.body.superAdmin.email).toBe(email);
      expect(response.body.superAdmin.role).toBe(UserRole.super_admin);

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { email },
      });
      expect(user).toBeTruthy();
      expect(user?.role).toBe(UserRole.super_admin);
    });

    it('should fail with duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/admin/super-admins')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          email: superAdmin.email,
          password: 'password123',
        });

      expect(response.status).toBe(409);
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/admin/super-admins')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          email: randomEmail(),
          password: 'short',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/super-admins', () => {
    beforeEach(async () => {
      // Create additional super admins
      await createTestSuperAdmin(prisma, randomEmail(), 'password123');
      await createTestSuperAdmin(prisma, randomEmail(), 'password123');
    });

    it('should get all super admins', async () => {
      const response = await request(app)
        .get('/api/v1/admin/super-admins')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('admins');
      expect(response.body.admins.length).toBeGreaterThan(0);
      expect(response.body.admins.every((a: any) => a.role === 'super_admin')).toBe(true);
    });
  });

  describe('PUT /api/v1/admin/tenants/:tenantId/toggle-status', () => {
    it('should deactivate an active tenant', async () => {
      const response = await request(app)
        .put(`/api/v1/admin/tenants/${activeTenant.id}/toggle-status`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.tenant.isActive).toBe(false);

      // Verify tenant was deactivated
      const updated = await prisma.tenant.findUnique({
        where: { id: activeTenant.id },
      });
      expect(updated?.isActive).toBe(false);
    });

    it('should activate a deactivated tenant', async () => {
      // First deactivate
      await prisma.tenant.update({
        where: { id: activeTenant.id },
        data: { isActive: false },
      });

      const response = await request(app)
        .put(`/api/v1/admin/tenants/${activeTenant.id}/toggle-status`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .send({
          isActive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.tenant.isActive).toBe(true);
    });
  });

  describe('GET /api/v1/admin/statistics', () => {
    beforeEach(async () => {
      // Create additional test data for statistics
      await createTestTenant(prisma, {
        type: TenantType.supplier,
        status: TenantStatus.active,
      });

      await createTestTenant(prisma, {
        type: TenantType.company,
        status: TenantStatus.pending,
      });
    });

    it('should get system statistics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics')
        .set('Authorization', `Bearer ${superAdmin.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalTenants');
      expect(response.body).toHaveProperty('totalUsers');
      expect(typeof response.body.totalTenants).toBe('number');
      expect(typeof response.body.totalUsers).toBe('number');
    });
  });
});


