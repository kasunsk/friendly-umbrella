export enum TenantType {
  SUPPLIER = 'supplier',
  COMPANY = 'company',
}

export enum UserRole {
  SUPPLIER_ADMIN = 'supplier_admin',
  SUPPLIER_STAFF = 'supplier_staff',
  COMPANY_ADMIN = 'company_admin',
  COMPANY_STAFF = 'company_staff',
}

export enum PriceType {
  DEFAULT = 'default',
  PRIVATE = 'private',
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: string;
  tenantType: TenantType;
}

export interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  supplierId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  isActive: boolean;
}

export interface DefaultPrice {
  id: string;
  productId: string;
  price: number;
  currency: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  isActive: boolean;
}

export interface PrivatePrice {
  id: string;
  productId: string;
  companyId: string;
  price: number;
  currency: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  isActive: boolean;
  notes?: string;
}

export interface ProductWithPrice extends Product {
  price?: number;
  priceType?: PriceType;
  currency?: string;
  supplierName?: string;
}

export interface WebSocketEvent {
  event: string;
  data: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}












