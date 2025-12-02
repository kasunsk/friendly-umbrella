import { apiGet, apiPost } from './api';

const BASE_PATH = '/api/v1/admin';

export interface Tenant {
  id: string;
  name: string;
  type: 'supplier' | 'company';
  email: string;
  phone: string | null;
  address: string | null;
  status: 'pending' | 'active' | 'rejected';
  isActive: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  users: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  }>;
  _count?: {
    users: number;
  };
}

export interface SuperAdmin {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'pending' | 'active' | 'rejected';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Statistics {
  tenants: {
    total: number;
    pending: number;
    active: number;
    rejected: number;
  };
  users: {
    total: number;
  };
}

// Get pending tenants
export async function getPendingTenants(): Promise<{ tenants: Tenant[] }> {
  return apiGet<{ tenants: Tenant[] }>(`${BASE_PATH}/tenants/pending`);
}

// Get all tenants (with optional status filter)
export async function getAllTenants(status?: 'pending' | 'active' | 'rejected'): Promise<{ tenants: Tenant[] }> {
  const query = status ? `?status=${status}` : '';
  return apiGet<{ tenants: Tenant[] }>(`${BASE_PATH}/tenants${query}`);
}

// Approve or reject a tenant
export async function approveTenant(
  tenantId: string,
  approved: boolean,
  reason?: string
): Promise<{ message: string; tenant: Tenant }> {
  return apiPost<{ message: string; tenant: Tenant }>(`${BASE_PATH}/tenants/${tenantId}/approve`, {
    approved,
    reason,
  });
}

// Get all super admins
export async function getSuperAdmins(): Promise<{ admins: SuperAdmin[] }> {
  return apiGet<{ admins: SuperAdmin[] }>(`${BASE_PATH}/super-admins`);
}

// Create a new super admin
export async function createSuperAdmin(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ message: string; superAdmin: SuperAdmin }> {
  return apiPost<{ message: string; superAdmin: SuperAdmin }>(`${BASE_PATH}/super-admins`, input);
}

// Get statistics
export async function getStatistics(): Promise<Statistics> {
  return apiGet<Statistics>(`${BASE_PATH}/statistics`);
}

