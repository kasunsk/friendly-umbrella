# User Registration and Role Management - Technical Documentation

This document provides technical details about the user registration and role management system implementation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Registration Flow](#registration-flow)
5. [Approval Workflow](#approval-workflow)
6. [Role and Permission System](#role-and-permission-system)
7. [Frontend Implementation](#frontend-implementation)
8. [Security Considerations](#security-considerations)

## Architecture Overview

The user registration and role management system is built on top of the existing multi-tenant architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Registration Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  New Company/Supplier Registration                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User → Register → Create Tenant (pending)            │   │
│  │        → Create User (pending, admin=true)           │   │
│  │        → Super Admin Approval → Tenant (active)      │   │
│  │        → User (active)                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  New User Registration                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User → Register → Select Tenant                      │   │
│  │        → Create User (pending)                       │   │
│  │        → Tenant Admin Approval → User (active)       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tenant Model

```prisma
model Tenant {
  id        String       @id @default(uuid())
  name      String
  type      TenantType   // company | supplier
  status    TenantStatus // pending | active | rejected
  email     String?
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  users     User[]
}
```

### User Model

```prisma
model User {
  id          String     @id @default(uuid())
  email       String     @unique
  password    String
  firstName   String?
  lastName    String?
  role        UserRole   // user | admin | super_admin
  status      UserStatus // pending | active | rejected | inactive
  permissions Json?      // { view: boolean, create: boolean, admin: boolean }
  
  tenantId    String?
  tenant      Tenant?    @relation(fields: [tenantId], references: [id])
  
  tenantType  TenantType?
  
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

### Enums

```prisma
enum TenantType {
  company
  supplier
  system  // For super admins
}

enum TenantStatus {
  pending
  active
  rejected
}

enum UserRole {
  user
  admin
  super_admin
}

enum UserStatus {
  pending
  active
  rejected
  inactive
}
```

## API Endpoints

### Authentication Endpoints

#### POST `/api/v1/auth/register`

Register a new user or organization.

**Request Body:**
```typescript
// New Company Registration
{
  registrationType: "new_company",
  tenantName: "Company Name",
  tenantType: "company",
  email: "admin@company.com",
  password: "password123",
  firstName?: "John",
  lastName?: "Doe"
}

// New Supplier Registration
{
  registrationType: "new_supplier",
  tenantName: "Supplier Name",
  tenantType: "supplier",
  email: "admin@supplier.com",
  password: "password123",
  firstName?: "Jane",
  lastName?: "Smith"
}

// New User for Company
{
  registrationType: "new_company_user",
  tenantId: "uuid-of-company",
  email: "user@company.com",
  password: "password123",
  firstName?: "Bob",
  lastName?: "Johnson"
}

// New User for Supplier
{
  registrationType: "new_supplier_user",
  tenantId: "uuid-of-supplier",
  email: "user@supplier.com",
  password: "password123",
  firstName?: "Alice",
  lastName?: "Brown"
}
```

**Response:**
```typescript
{
  message: "Registration successful. Your account is pending approval.",
  // tokens only returned if immediately active (super admin)
  tokens?: {
    accessToken: string,
    refreshToken: string
  }
}
```

#### GET `/api/v1/auth/tenants/active`

Get list of active tenants for user registration.

**Query Parameters:**
- `type`: `company` | `supplier` (optional, filters by type)

**Response:**
```typescript
{
  tenants: [
    {
      id: "uuid",
      name: "Tenant Name",
      type: "company" | "supplier",
      email: "contact@tenant.com"
    }
  ]
}
```

### Tenant Admin Endpoints

#### GET `/api/v1/tenant-admin/users`

Get all users in the tenant (requires tenant admin).

**Response:**
```typescript
{
  users: [
    {
      id: "uuid",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user" | "admin",
      status: "pending" | "active" | "rejected" | "inactive",
      permissions: {
        view: boolean,
        create: boolean,
        admin: boolean
      },
      createdAt: "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### PUT `/api/v1/tenant-admin/users/:userId/approve`

Approve a pending user (requires tenant admin).

**Response:**
```typescript
{
  message: "User approved successfully",
  user: { /* user object */ }
}
```

#### PUT `/api/v1/tenant-admin/users/:userId/reject`

Reject a pending user (requires tenant admin).

**Response:**
```typescript
{
  message: "User rejected successfully",
  user: { /* user object */ }
}
```

#### PUT `/api/v1/tenant-admin/users/:userId/permissions`

Update user permissions (requires tenant admin).

**Request Body:**
```typescript
{
  permissions: {
    view: boolean,
    create: boolean,
    admin: boolean
  }
}
```

**Response:**
```typescript
{
  message: "Permissions updated successfully",
  user: { /* updated user object */ }
}
```

#### PUT `/api/v1/tenant-admin/users/:userId/status`

Toggle user status (activate/deactivate).

**Request Body:**
```typescript
{
  status: "active" | "inactive"
}
```

### Super Admin Endpoints

#### GET `/api/v1/super-admin/tenants/pending`

Get all pending tenant registrations.

**Response:**
```typescript
{
  tenants: [
    {
      id: "uuid",
      name: "Tenant Name",
      type: "company" | "supplier",
      email: "contact@tenant.com",
      status: "pending",
      createdAt: "2024-01-01T00:00:00Z",
      adminUser: {
        email: "admin@tenant.com",
        firstName: "Admin",
        lastName: "User"
      }
    }
  ]
}
```

#### PUT `/api/v1/super-admin/tenants/:tenantId/approve`

Approve a pending tenant (activates tenant and admin user).

**Response:**
```typescript
{
  message: "Tenant approved successfully",
  tenant: { /* tenant object */ },
  adminUser: { /* admin user object */ }
}
```

#### PUT `/api/v1/super-admin/tenants/:tenantId/reject`

Reject a pending tenant.

**Response:**
```typescript
{
  message: "Tenant rejected successfully"
}
```

#### POST `/api/v1/super-admin/super-admins`

Create a new super admin user.

**Request Body:**
```typescript
{
  email: "superadmin@system.com",
  password: "password123",
  firstName?: "Super",
  lastName?: "Admin"
}
```

## Registration Flow

### Backend Registration Logic

The registration flow is handled in `authService.register()`:

```typescript
// Simplified flow
async register(input: RegisterInput) {
  switch (input.registrationType) {
    case 'new_company':
    case 'new_supplier':
      // 1. Create tenant with status='pending'
      const tenant = await prisma.tenant.create({
        data: {
          name: input.tenantName,
          type: input.tenantType,
          status: 'pending'
        }
      });
      
      // 2. Create admin user with status='pending', admin=true
      const adminUser = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          tenantId: tenant.id,
          role: 'admin',
          status: 'pending',
          permissions: { view: true, create: true, admin: true }
        }
      });
      
      return { message: "Pending super admin approval" };
      
    case 'new_company_user':
    case 'new_supplier_user':
      // 1. Verify tenant exists and is active
      const tenant = await prisma.tenant.findUnique({
        where: { id: input.tenantId, status: 'active' }
      });
      
      // 2. Create user with status='pending'
      const user = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          tenantId: input.tenantId,
          role: 'user',
          status: 'pending'
        }
      });
      
      return { message: "Pending tenant admin approval" };
  }
}
```

### Frontend Registration Form

The registration form dynamically adjusts based on selection:

```typescript
// Registration type selection
const registrationType = watch('registrationType');

// Show tenant name input for new company/supplier
{(registrationType === 'new_company' || registrationType === 'new_supplier') && (
  <Input name="tenantName" required />
)}

// Show tenant dropdown for new user
{(registrationType === 'new_company_user' || registrationType === 'new_supplier_user') && (
  <Select name="tenantId">
    {tenants.map(tenant => (
      <option key={tenant.id} value={tenant.id}>
        {tenant.name}
      </option>
    ))}
  </Select>
)}
```

## Approval Workflow

### Tenant Approval (Super Admin)

```typescript
async approveTenant(tenantId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Update tenant status to active
    const tenant = await tx.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' }
    });
    
    // 2. Update admin user status to active
    const adminUser = await tx.user.updateMany({
      where: {
        tenantId: tenantId,
        role: 'admin',
        status: 'pending'
      },
      data: { status: 'active' }
    });
    
    return { tenant, adminUser };
  });
}
```

### User Approval (Tenant Admin)

```typescript
async approveUser(userId: string, permissions?: Permissions) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'active',
      ...(permissions && { permissions })
    }
  });
}
```

## Role and Permission System

### Permission Structure

Permissions are stored as JSON in the User model:

```typescript
interface Permissions {
  view: boolean;    // Can view data
  create: boolean;  // Can create/edit items
  admin: boolean;   // Can manage users and settings
}
```

### Default Permissions by Role

```typescript
const DEFAULT_PERMISSIONS = {
  user: { view: true, create: false, admin: false },
  admin: { view: true, create: true, admin: true },
  super_admin: { view: true, create: true, admin: true }
};
```

### Permission Checks

Middleware checks permissions before allowing actions:

```typescript
function requirePermission(permission: 'view' | 'create' | 'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const permissions = user.permissions as Permissions;
    
    if (!permissions[permission]) {
      return res.status(403).json({
        error: `Permission denied: ${permission} required`
      });
    }
    
    next();
  };
}
```

## Frontend Implementation

### Registration Page

Location: `packages/frontend/src/app/auth/register/page.tsx`

Key features:
- Dynamic form based on registration type
- Tenant dropdown loading for new user registrations
- Form validation with react-hook-form
- Error handling and user feedback

### User Management Component

Location: `packages/frontend/src/components/admin/UserManagement.tsx`

Key features:
- List all users in organization
- Filter by status (pending/active/inactive)
- Approve/reject pending users
- Edit user permissions
- Toggle user status

### Super Admin Dashboard

Location: `packages/frontend/src/app/admin/dashboard/page.tsx`

Key features:
- System-wide statistics
- Pending tenant approvals
- All tenants management
- Super admin management

## Security Considerations

### Authentication

- JWT tokens for session management
- Password hashing with bcrypt (10 rounds)
- Refresh token rotation

### Authorization

- Role-based access control (RBAC)
- Permission-based fine-grained access
- Tenant isolation at database level
- Super admin bypass for system operations

### Data Isolation

- Multi-tenant data separation
- User can only access their tenant's data
- Admin users restricted to their organization
- Super admin has system-wide read access

### Input Validation

- Zod schema validation on backend
- Express-validator for request validation
- Frontend form validation with react-hook-form
- SQL injection prevention via Prisma ORM

### Status Management

- Pending status prevents unauthorized access
- Rejected users cannot log in
- Inactive users are soft-deleted
- Transaction-safe status updates

## Testing Considerations

### Unit Tests

- Registration service methods
- Approval workflow logic
- Permission checks
- Validation rules

### Integration Tests

- Registration API endpoints
- Approval API endpoints
- User management flows
- Super admin operations

### E2E Tests

- Complete registration flow
- Approval workflow
- Role assignment
- Permission enforcement

## Migration Notes

### Database Migrations

The system uses Prisma migrations to manage schema changes:

```bash
# Create migration
npx prisma migrate dev --name add_user_registration_features

# Apply migration
npx prisma migrate deploy
```

### Backward Compatibility

- Existing users maintain their current roles
- Legacy permission structure is supported
- Gradual migration path for existing tenants

## Performance Considerations

### Database Queries

- Indexed lookups on `email`, `tenantId`, `status`
- Efficient tenant filtering
- Pagination for user lists

### Caching Strategy

- Tenant lists cached for registration dropdowns
- User permissions cached in JWT token
- Statistics cached with TTL

## Future Enhancements

Potential improvements:

1. **Email Notifications**
   - Registration confirmation emails
   - Approval/rejection notifications
   - Status change alerts

2. **Bulk Operations**
   - Bulk user approval
   - Bulk permission updates
   - CSV user import

3. **Audit Logging**
   - Track all approval actions
   - Permission change history
   - Registration attempts

4. **Advanced Roles**
   - Custom role definitions
   - Role templates
   - Hierarchical permissions

## Related Documentation

- [API Reference](./api-reference.md)
- [Architecture Overview](./architecture.md)
- [Authentication Guide](./authentication.md) (if exists)
- [Database Schema](../database/schema.md) (if exists)

---

**Last Updated**: 2024-11-29  
**Version**: 1.0.0





