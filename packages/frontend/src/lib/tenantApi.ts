import { apiGet } from './api';

export interface Tenant {
  id: string;
  name: string;
  type: 'supplier' | 'company';
  email: string;
}

// Get active tenants for registration
export async function getActiveTenants(type?: 'supplier' | 'company'): Promise<{ tenants: Tenant[] }> {
  const query = type ? `?type=${type}` : '';
  return apiGet<{ tenants: Tenant[] }>(`/api/v1/auth/tenants${query}`);
}




