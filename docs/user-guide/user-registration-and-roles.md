# User Registration and Role Management Guide

This guide explains the comprehensive user registration and role management system implemented in the Construction Pricing Platform.

## Table of Contents

1. [Overview](#overview)
2. [Registration Types](#registration-types)
3. [Registration Process](#registration-process)
4. [Admin Privileges](#admin-privileges)
5. [User Approval Workflow](#user-approval-workflow)
6. [Role Management](#role-management)
7. [Super Admin Features](#super-admin-features)

## Overview

The platform supports a multi-level registration and approval system:

- **New Company/Supplier Registration** - Creates a new organization and assigns admin privileges
- **New User Registration** - Adds users to existing organizations (requires admin approval)
- **Admin User Management** - Admins can approve/reject users and manage roles
- **Super Admin Oversight** - System-wide admin controls for tenant approvals

## Registration Types

When you visit the registration page (`/auth/register`), you'll see four registration options:

### 1. New Company Registration

- Creates a new company organization
- The registrant automatically becomes the **Company Admin**
- Status: **Pending** until approved by a Super Admin
- Full access rights once approved

**Required Fields:**
- Company Name
- Email address
- Password (minimum 8 characters)
- First Name (optional)
- Last Name (optional)

### 2. New Supplier Registration

- Creates a new supplier organization
- The registrant automatically becomes the **Supplier Admin**
- Status: **Pending** until approved by a Super Admin
- Full access rights once approved

**Required Fields:**
- Supplier Name
- Email address
- Password (minimum 8 characters)
- First Name (optional)
- Last Name (optional)

### 3. New User for a Company

- Adds a new user to an existing company
- Status: **Pending** until approved by the Company Admin
- Must select an existing active company
- Admin assigns role and permissions upon approval

**Required Fields:**
- Company Selection (from dropdown list)
- Email address
- Password (minimum 8 characters)
- First Name (optional)
- Last Name (optional)

### 4. New User for a Supplier

- Adds a new user to an existing supplier
- Status: **Pending** until approved by the Supplier Admin
- Must select an existing active supplier
- Admin assigns role and permissions upon approval

**Required Fields:**
- Supplier Selection (from dropdown list)
- Email address
- Password (minimum 8 characters)
- First Name (optional)
- Last Name (optional)

## Registration Process

### Step-by-Step Registration

1. **Access Registration Page**
   - Navigate to `http://localhost:3000/auth/register`
   - You'll see the registration form with a "Registration Type" dropdown

2. **Select Registration Type**
   - Choose one of the four registration options from the dropdown
   - The form will dynamically adjust based on your selection

3. **Fill Required Information**
   - For new companies/suppliers: Enter organization name
   - For new users: Select existing organization from dropdown
   - Enter email, password, and optional personal information

4. **Submit Registration**
   - Click "Create account" button
   - You'll receive immediate feedback on the registration status

5. **Pending Approval Notification**
   - If your account requires approval, you'll see a success message
   - You'll be redirected to the login page with a pending approval notice
   - You cannot log in until approved

### Registration Status Flow

```
New Company/Supplier Registration:
  Registration → Pending → Super Admin Approval → Active

New User Registration:
  Registration → Pending → Tenant Admin Approval → Active
```

## Admin Privileges

### Company/Supplier Admins

When you register a new company or supplier, you automatically receive:

- **Full Admin Access**
  - View all products and prices
  - Create, edit, and delete products
  - Manage user accounts within your organization
  - Approve or reject new user registrations
  - Assign roles and permissions to users

- **Permissions Granted**
  - `view: true` - Can view all data
  - `create: true` - Can create new items
  - `admin: true` - Full administrative access

### Super Admins

Super Admins have system-wide privileges:

- Approve/reject new company registrations
- Approve/reject new supplier registrations
- View all tenants (companies and suppliers)
- Create other super admin accounts
- Access system-wide statistics
- Manage tenant statuses

## User Approval Workflow

### For Tenant Admins (Company/Supplier)

1. **Access User Management**
   - Log in to your dashboard
   - Navigate to "User Management" section
   - Click on "Users" in the navigation menu

2. **View Pending Users**
   - The User Management interface shows all users in your organization
   - Pending users are clearly marked with "Pending" status
   - View user details (name, email, registration date)

3. **Approve or Reject Users**
   - Click "Approve" to activate a user account
   - Click "Reject" to decline the registration
   - Rejected users cannot log in and must re-register

4. **Assign Roles and Permissions**
   - After approval, assign appropriate role and permissions
   - Roles: `view`, `create`, `admin`
   - Permissions can be customized per user

### For Super Admins

1. **Access Admin Dashboard**
   - Log in with super admin credentials
   - Navigate to `/admin/dashboard`
   - Go to "Pending Requests" tab

2. **Review Pending Tenants**
   - View all pending company and supplier registrations
   - See tenant details: name, type, email, registration date

3. **Approve or Reject Tenants**
   - Click "Approve" to activate the tenant and their admin account
   - Click "Reject" to decline the registration
   - Rejected tenants must re-register

## Role Management

### Available Roles

Users within an organization can have different roles with varying permissions:

#### 1. View Role
- **Permissions**: `view: true`, `create: false`, `admin: false`
- **Capabilities**:
  - View products and prices
  - Read-only access to data
  - Cannot create or modify items

#### 2. Create Role
- **Permissions**: `view: true`, `create: true`, `admin: false`
- **Capabilities**:
  - All view capabilities
  - Create new products
  - Edit existing products
  - Cannot manage users or system settings

#### 3. Admin Role
- **Permissions**: `view: true`, `create: true`, `admin: true`
- **Capabilities**:
  - All view and create capabilities
  - Approve/reject user registrations
  - Manage user roles and permissions
  - Full administrative access

### Managing User Roles

As an admin, you can modify user roles at any time:

1. **Access User Management**
   - Navigate to the User Management page
   - Find the user you want to modify

2. **Edit User Permissions**
   - Click "Edit" or "Manage" button for the user
   - Select the desired permissions:
     - ✓ View - Allow user to view data
     - ✓ Create - Allow user to create/edit items
     - ✓ Admin - Grant administrative privileges

3. **Save Changes**
   - Click "Save" to apply changes
   - Changes take effect immediately
   - User will have new permissions on next login

### Changing User Status

Admins can also toggle user status:

- **Activate**: Enable a user account
- **Deactivate**: Temporarily disable access (user cannot log in)
- **Reject**: Permanently reject a pending registration

## Super Admin Features

### Accessing Super Admin Dashboard

1. Log in with super admin credentials
2. You'll be automatically redirected to `/admin/dashboard`
3. The dashboard provides several tabs:

### Dashboard Tabs

#### Overview Tab
- System-wide statistics
- Total companies, suppliers, and users
- Active vs. pending registrations

#### Pending Requests Tab
- List of all pending tenant registrations
- Filter by type (company/supplier)
- Approve/reject actions

#### All Tenants Tab
- Complete list of all registered tenants
- View tenant details and status
- Activate/deactivate tenants
- Search and filter capabilities

#### Super Admins Tab
- List of all super admin accounts
- Create new super admin users
- Manage super admin access

### Creating a Super Admin

1. Navigate to "Super Admins" tab
2. Click "Create Super Admin" button
3. Fill in:
   - Email address
   - Password
   - First Name (optional)
   - Last Name (optional)
4. Click "Create"
5. New super admin can immediately log in

## Best Practices

### For New Company/Supplier Registrants

- Provide accurate organization information
- Use a business email address
- Wait for super admin approval before attempting to log in
- Check email for approval notifications (if implemented)

### For Admins Managing Users

- Review user registration details before approval
- Assign appropriate roles based on user needs
- Regularly audit user permissions
- Deactivate users who no longer need access
- Document role assignments for compliance

### For Super Admins

- Review tenant registrations promptly
- Verify organization details before approval
- Maintain a reasonable number of super admin accounts
- Regularly review system statistics
- Monitor for suspicious registration activity

## Troubleshooting

### Registration Issues

**Problem**: "Invalid registration type" error
- **Solution**: Ensure you've selected a registration type from the dropdown before submitting

**Problem**: Cannot select company/supplier
- **Solution**: Verify that active companies/suppliers exist in the system. New registrations must be approved first.

**Problem**: Registration successful but cannot log in
- **Solution**: Your account is pending approval. Contact your organization admin or super admin.

### Approval Issues

**Problem**: Cannot see pending users
- **Solution**: Ensure you're logged in as an admin user with the correct permissions

**Problem**: Cannot approve users
- **Solution**: Verify you have admin privileges. Only admins can approve/reject users.

**Problem**: User still cannot log in after approval
- **Solution**: Check user status in User Management. Ensure status is set to "Active".

## Related Documentation

- [Getting Started Guide](./getting-started.md) - Basic platform introduction
- [Company Guide](./company-guide.md) - Company user features
- [Supplier Guide](./supplier-guide.md) - Supplier user features
- [API Testing Guide](./api-testing.md) - API documentation

## Support

For issues or questions about user registration and role management:

1. Check this documentation first
2. Contact your organization admin
3. Contact super admin for tenant-level issues
4. Review technical documentation for API access

---

**Last Updated**: 2024-11-29




