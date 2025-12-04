# User Registration and Role Management Feature

## Overview

This document provides a comprehensive overview of the User Registration and Role Management feature added to the Construction Pricing Platform.

## Feature Summary

The platform now includes a complete user registration and role management system that allows:

1. **Four Registration Types**
   - New Company Registration
   - New Supplier Registration
   - New User for a Company
   - New User for a Supplier

2. **Approval Workflow**
   - Two-level approval system (Super Admin → Tenant Admin)
   - Pending/Active/Rejected status management
   - Automatic admin privileges for organization creators

3. **Role and Permission Management**
   - Three permission levels: view, create, admin
   - Granular permission assignment
   - User status management (active/inactive)

4. **Admin Features**
   - Tenant Admin: Manage users within their organization
   - Super Admin: System-wide tenant and user oversight

## Key Components

### Backend

- **Services**
  - `authService.ts` - Registration logic with 4 registration types
  - `tenantAdminService.ts` - User management within tenants
  - `superAdminService.ts` - Tenant and super admin management

- **Routes**
  - `authRoutes.ts` - Registration and authentication endpoints
  - `tenantAdminRoutes.ts` - User management endpoints
  - `superAdminRoutes.ts` - Tenant and system management endpoints

- **Database Schema**
  - `Tenant` model with status field
  - `User` model with status, role, and permissions
  - Enums for TenantType, TenantStatus, UserRole, UserStatus

### Frontend

- **Pages**
  - `/auth/register` - Enhanced registration form with 4 types
  - `/auth/login` - Updated with pending approval messaging
  - `/company/users` - Company admin user management
  - `/supplier/users` - Supplier admin user management
  - `/admin/dashboard` - Super admin dashboard

- **Components**
  - `UserManagement.tsx` - Tenant admin user management interface
  - `PendingTenants.tsx` - Super admin pending tenant approvals
  - `AllTenants.tsx` - Super admin tenant management
  - `SuperAdminManagement.tsx` - Super admin account management
  - `StatisticsOverview.tsx` - System-wide statistics

- **API Clients**
  - `tenantAdminApi.ts` - Tenant admin API functions
  - `adminApi.ts` - Super admin API functions
  - `tenantApi.ts` - Tenant listing API functions

## User Flows

### New Company/Supplier Registration

```
User Registration → Tenant Created (pending)
                  → Admin User Created (pending)
                  → Super Admin Approval
                  → Tenant Active
                  → Admin User Active
                  → User Can Login
```

### New User Registration

```
User Registration → User Created (pending)
                  → Tenant Admin Approval
                  → Permissions Assigned
                  → User Active
                  → User Can Login
```

### User Management (Tenant Admin)

```
Admin Login → User Management Page
           → View Pending Users
           → Approve/Reject Users
           → Assign Permissions
           → Manage User Status
```

### Tenant Management (Super Admin)

```
Super Admin Login → Admin Dashboard
                 → View Pending Tenants
                 → Approve/Reject Tenants
                 → Manage All Tenants
                 → Create Super Admins
```

## API Endpoints

### Registration Endpoints

- `POST /api/v1/auth/register` - Register new user/organization
- `GET /api/v1/auth/tenants/active` - Get active tenants for user registration

### Tenant Admin Endpoints

- `GET /api/v1/tenant-admin/users` - Get all users in tenant
- `PUT /api/v1/tenant-admin/users/:userId/approve` - Approve user
- `PUT /api/v1/tenant-admin/users/:userId/reject` - Reject user
- `PUT /api/v1/tenant-admin/users/:userId/permissions` - Update permissions
- `PUT /api/v1/tenant-admin/users/:userId/status` - Update user status

### Super Admin Endpoints

- `GET /api/v1/super-admin/tenants/pending` - Get pending tenants
- `GET /api/v1/super-admin/tenants` - Get all tenants
- `PUT /api/v1/super-admin/tenants/:tenantId/approve` - Approve tenant
- `PUT /api/v1/super-admin/tenants/:tenantId/reject` - Reject tenant
- `GET /api/v1/super-admin/super-admins` - Get all super admins
- `POST /api/v1/super-admin/super-admins` - Create super admin
- `GET /api/v1/super-admin/statistics` - Get system statistics

## Database Changes

### New Fields

- `Tenant.status` - TenantStatus enum (pending, active, rejected)
- `User.status` - UserStatus enum (pending, active, rejected, inactive)
- `User.permissions` - JSON field for granular permissions

### New Enums

- `TenantType` - Added `system` for super admins
- `TenantStatus` - New enum for tenant status
- `UserRole` - Added `super_admin` role
- `UserStatus` - New enum for user status

## Security Features

- Password hashing with bcrypt
- JWT authentication
- Role-based access control (RBAC)
- Permission-based fine-grained access
- Multi-tenant data isolation
- Input validation and sanitization
- Status-based access control

## Documentation

### User Documentation

- [User Registration and Role Management Guide](./user-guide/user-registration-and-roles.md)
- Updated [Getting Started Guide](./user-guide/getting-started.md)

### Technical Documentation

- [Technical Implementation Details](./technical/user-registration-role-management.md)
- Updated API Reference (coming soon)

## Testing Checklist

- [x] Registration forms for all 4 types
- [x] Pending approval workflow
- [x] Super admin tenant approval
- [x] Tenant admin user approval
- [x] Permission assignment
- [x] Status management
- [x] Error handling
- [x] Form validation
- [x] User interface components
- [x] API endpoints

## Future Enhancements

Potential improvements:

1. Email notifications for approvals
2. Bulk user operations
3. Advanced audit logging
4. Custom role definitions
5. Permission templates
6. User invitation system
7. Self-service password reset

## Migration Notes

- All existing users maintain their current roles
- Legacy permission structure is supported
- New status fields default appropriately
- Backward compatible with existing data

## Version

**Feature Version**: 1.0.0  
**Date Added**: 2024-11-29  
**Status**: ✅ Complete

---

For detailed usage instructions, see [User Registration and Role Management Guide](./user-guide/user-registration-and-roles.md).  
For technical details, see [Technical Documentation](./technical/user-registration-role-management.md).





