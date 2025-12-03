import { apiGet, apiPost, apiPut } from './api';

const BASE_PATH = '/api/v1/tenant-admin';

export interface TenantUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: 'pending' | 'active' | 'rejected';
  isActive: boolean;
  permissions: Record<string, any> | null;
  lastLoginAt: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface TenantStatistics {
  users: {
    total: number;
    pending: number;
    active: number;
    rejected: number;
  };
}

// Get pending users
export async function getPendingUsers(): Promise<{ users: TenantUser[] }> {
  return apiGet<{ users: TenantUser[] }>(`${BASE_PATH}/users/pending`);
}

// Get all users in tenant
export async function getTenantUsers(status?: 'pending' | 'active' | 'rejected'): Promise<{ users: TenantUser[] }> {
  const query = status ? `?status=${status}` : '';
  return apiGet<{ users: TenantUser[] }>(`${BASE_PATH}/users${query}`);
}

// Approve or reject a user
export async function approveUser(
  userId: string,
  approved: boolean,
  reason?: string
): Promise<{ message: string; user: TenantUser }> {
  return apiPost<{ message: string; user: TenantUser }>(`${BASE_PATH}/users/${userId}/approve`, {
    approved,
    reason,
  });
}

// Assign role permissions (view/create/admin)
export async function assignRolePermissions(
  userId: string,
  roleType: 'view' | 'create' | 'admin'
): Promise<{ message: string; user: TenantUser }> {
  return apiPut<{ message: string; user: TenantUser }>(`${BASE_PATH}/users/${userId}/assign-role`, {
    roleType,
  });
}

// Update user permissions
export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, any>
): Promise<{ message: string; user: TenantUser }> {
  return apiPut<{ message: string; user: TenantUser }>(`${BASE_PATH}/users/${userId}/permissions`, {
    permissions,
  });
}

// Get tenant statistics
export async function getTenantStatistics(): Promise<TenantStatistics> {
  return apiGet<TenantStatistics>(`${BASE_PATH}/statistics`);
}




