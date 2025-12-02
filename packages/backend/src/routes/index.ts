import { Express } from 'express';
import { authRoutes } from './authRoutes';
import { productRoutes } from './productRoutes';
import { priceRoutes } from './priceRoutes';
import { supplierRoutes } from './supplierRoutes';
import superAdminRoutes from './superAdminRoutes';
import tenantAdminRoutes from './tenantAdminRoutes';

export function setupRoutes(app: Express) {
  // API version prefix
  app.use('/api/v1', authRoutes);
  
  // Super admin routes (requires super_admin role)
  app.use('/api/v1/admin', superAdminRoutes);
  
  // Tenant admin routes (requires tenant admin role)
  app.use('/api/v1/tenant-admin', tenantAdminRoutes);
  
  // Register company routes (supplierRoutes) BEFORE supplier-specific routes
  // to ensure /products/search matches correctly for companies
  app.use('/api/v1', supplierRoutes);
  // Register supplier-specific routes after company routes
  app.use('/api/v1', productRoutes);
  app.use('/api/v1', priceRoutes);
}

