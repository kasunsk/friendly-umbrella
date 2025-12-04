# API Testing Guide

Guide for testing the Construction Pricing Platform API using Postman or cURL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Postman Setup](#postman-setup)
3. [cURL Commands](#curl-commands)
4. [Testing Workflow](#testing-workflow)
5. [Common Scenarios](#common-scenarios)

## Prerequisites

- Backend server running on `http://localhost:8000`
- Postman installed (optional)
- cURL installed (for command line testing)
- Valid user account (supplier or company)

## Postman Setup

### Step 1: Import Collection

1. Open Postman
2. Click "Import" button
3. Select `Construction_Pricing_API.postman_collection.json`
4. Collection will appear in your workspace

### Step 2: Import Environment

1. Click "Import" again
2. Select `Postman_Environment.postman_environment.json`
3. Environment will be available in dropdown

### Step 3: Select Environment

1. Click the environment dropdown (top right)
2. Select "Construction Pricing Platform"
3. Verify `baseUrl` is set to `http://localhost:8000`

### Step 4: Test Registration

1. Open "Authentication" folder
2. Select "Register - Supplier"
3. Click "Send"
4. Check response - tokens will be saved automatically

## cURL Commands

### Authentication

#### Register Supplier
```bash
curl.exe -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "@test-register.json"
```

#### Login
```bash
curl.exe -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "@test-login.json"
```

#### Get Current User
```bash
curl.exe -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Product Management (Supplier)

#### Create Product
```bash
curl.exe -X POST http://localhost:8000/api/v1/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "@test-product.json"
```

#### List Products
```bash
curl.exe -X GET http://localhost:8000/api/v1/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get Product Stats
```bash
curl.exe -X GET http://localhost:8000/api/v1/products/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Price Management (Supplier)

#### Update Default Price
```bash
curl.exe -X PUT http://localhost:8000/api/v1/products/{productId}/default-price \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "@test-price.json"
```

#### Create Private Price
```bash
curl.exe -X POST http://localhost:8000/api/v1/products/{productId}/private-prices \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "company-uuid",
    "price": 140.00,
    "currency": "USD"
  }'
```

### Browsing (Company)

#### List Suppliers
```bash
curl.exe -X GET http://localhost:8000/api/v1/suppliers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Search Products
```bash
curl.exe -X GET "http://localhost:8000/api/v1/products/search?q=steel&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Testing Workflow

### Complete Supplier Workflow

1. **Register Supplier Account**
   ```bash
   POST /api/v1/auth/register
   ```
   - Save `accessToken` and `tenantId` from response

2. **Create Product**
   ```bash
   POST /api/v1/products
   ```
   - Save `productId` from response

3. **Set Default Price**
   ```bash
   PUT /api/v1/products/{productId}/default-price
   ```

4. **View Product Stats**
   ```bash
   GET /api/v1/products/stats
   ```

### Complete Company Workflow

1. **Register Company Account**
   ```bash
   POST /api/v1/auth/register
   ```
   - Save `accessToken` and `tenantId`

2. **List Suppliers**
   ```bash
   GET /api/v1/suppliers
   ```
   - Save `supplierId` from response

3. **Browse Supplier Products**
   ```bash
   GET /api/v1/suppliers/{supplierId}/products
   ```

4. **Search Products**
   ```bash
   GET /api/v1/products/search?q=steel
   ```

5. **Get Product Price**
   ```bash
   GET /api/v1/products/{productId}/price
   ```

## Common Scenarios

### Scenario 1: Supplier Adds Product with Price

```bash
# 1. Login
POST /api/v1/auth/login
# Response: { tokens: { accessToken: "..." } }

# 2. Create Product
POST /api/v1/products
Body: {
  "sku": "STEEL-001",
  "name": "Steel Bar",
  "unit": "piece",
  "defaultPrice": 150.00,
  "currency": "USD"
}

# 3. Verify Product
GET /api/v1/products
```

### Scenario 2: Company Searches and Views Prices

```bash
# 1. Login as Company
POST /api/v1/auth/login

# 2. Search Products
GET /api/v1/products/search?q=steel

# 3. Get Specific Product Price
GET /api/v1/products/{productId}/price
```

### Scenario 3: Supplier Sets Private Price

```bash
# 1. Login as Supplier
POST /api/v1/auth/login

# 2. Create Private Price
POST /api/v1/products/{productId}/private-prices
Body: {
  "companyId": "company-uuid",
  "price": 140.00,
  "currency": "USD",
  "notes": "Volume discount"
}

# 3. List Private Prices
GET /api/v1/products/{productId}/private-prices
```

## Troubleshooting

### Authentication Errors

**401 Unauthorized**
- Token expired - use refresh token
- Invalid token - login again
- Missing Authorization header

**Solution:**
```bash
# Refresh token
POST /api/v1/auth/refresh
Body: { "refreshToken": "..." }
```

### Validation Errors

**400 Bad Request**
- Missing required fields
- Invalid data format
- Validation failed

**Solution:**
- Check request body format
- Verify required fields are present
- Review error message for details

### Not Found Errors

**404 Not Found**
- Invalid product ID
- Invalid supplier ID
- Resource doesn't exist

**Solution:**
- Verify IDs are correct UUIDs
- Check if resource exists
- Use list endpoints to find valid IDs

## Best Practices

1. **Save Tokens**
   - Store access tokens securely
   - Use refresh tokens before expiration
   - Don't hardcode tokens in code

2. **Handle Errors**
   - Check response status codes
   - Read error messages
   - Implement retry logic

3. **Test Incrementally**
   - Test authentication first
   - Then test individual endpoints
   - Finally test complete workflows

4. **Use Environment Variables**
   - Store base URLs
   - Manage tokens
   - Switch between environments

## Next Steps

- Review [API Reference](../technical/api-reference.md) for complete endpoint documentation
- Check [Architecture](../technical/architecture.md) for system design
- See [Setup Guide](../technical/setup.md) for development setup












