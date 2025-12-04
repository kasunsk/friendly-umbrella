# API Reference

Complete API endpoint documentation for the Construction Pricing Platform.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

All endpoints (except registration and login) require authentication via Bearer token.

```
Authorization: Bearer {accessToken}
```

## Authentication Endpoints

### Register

**POST** `/auth/register`

Register a new user account (supplier or company).

**Request Body:**
```json
{
  "tenantName": "ABC Suppliers",
  "tenantType": "supplier",
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "supplier_admin",
    "tenantId": "uuid",
    "tenantType": "supplier"
  },
  "tokens": {
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token"
  }
}
```

### Login

**POST** `/auth/login`

Authenticate and receive access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": { ... },
  "tokens": {
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token"
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-token"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-jwt-token"
}
```

### Get Current User

**GET** `/auth/me`

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "supplier_admin",
  "tenant": {
    "id": "uuid",
    "name": "ABC Suppliers",
    "type": "supplier"
  }
}
```

## Product Endpoints (Supplier Only)

### List Products

**GET** `/products?includeInactive=false`

Get all products for the authenticated supplier.

**Query Parameters:**
- `includeInactive` (boolean, optional): Include inactive products

**Response:** `200 OK`
```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "PROD-001",
      "name": "Steel Beam",
      "description": "Description",
      "category": "Steel",
      "unit": "piece",
      "isActive": true,
      "defaultPrices": [...],
      "_count": {
        "privatePrices": 2
      }
    }
  ]
}
```

### Get Product Statistics

**GET** `/products/stats`

Get supplier product statistics.

**Response:** `200 OK`
```json
{
  "totalProducts": 50,
  "activeProducts": 45,
  "productsWithPrices": 40,
  "productsWithPrivatePrices": 15
}
```

### Get Product by ID

**GET** `/products/:id`

Get a single product by ID.

**Response:** `200 OK`
```json
{
  "product": {
    "id": "uuid",
    "sku": "PROD-001",
    "name": "Steel Beam",
    ...
  }
}
```

### Create Product

**POST** `/products`

Create a new product.

**Request Body:**
```json
{
  "sku": "PROD-001",
  "name": "Steel Beam",
  "description": "High-quality steel beam",
  "category": "Steel",
  "unit": "piece",
  "defaultPrice": 150.00,
  "currency": "USD"
}
```

**Response:** `201 Created`
```json
{
  "product": {
    "id": "uuid",
    "sku": "PROD-001",
    ...
  }
}
```

### Update Product

**PUT** `/products/:id`

Update an existing product.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "category": "Updated Category",
  "isActive": true
}
```

**Response:** `200 OK`
```json
{
  "product": { ... }
}
```

### Delete Product

**DELETE** `/products/:id`

Soft delete a product (sets isActive to false).

**Response:** `204 No Content`

## Price Endpoints (Supplier Only)

### Update Default Price

**PUT** `/products/:id/default-price`

Update or create default price for a product.

**Request Body:**
```json
{
  "price": 200.00,
  "currency": "USD",
  "effectiveFrom": "2024-01-01T00:00:00Z",
  "effectiveUntil": null
}
```

**Response:** `200 OK`
```json
{
  "defaultPrice": {
    "id": "uuid",
    "price": 200.00,
    "currency": "USD",
    ...
  }
}
```

### Create Private Price

**POST** `/products/:id/private-prices`

Create a company-specific private price.

**Request Body:**
```json
{
  "companyId": "company-uuid",
  "price": 180.00,
  "currency": "USD",
  "notes": "Volume discount"
}
```

**Response:** `201 Created`
```json
{
  "privatePrice": {
    "id": "uuid",
    "price": 180.00,
    ...
  }
}
```

### List Private Prices

**GET** `/products/:id/private-prices`

Get all private prices for a product.

**Response:** `200 OK`
```json
{
  "privatePrices": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "price": 180.00,
      ...
    }
  ]
}
```

### Update Private Price

**PUT** `/private-prices/:id`

Update an existing private price.

**Request Body:**
```json
{
  "price": 175.00,
  "notes": "Updated discount"
}
```

**Response:** `200 OK`

### Delete Private Price

**DELETE** `/private-prices/:id`

Delete a private price.

**Response:** `204 No Content`

### Get Price History

**GET** `/products/:id/price-history`

Get price change history for a product.

**Response:** `200 OK`
```json
{
  "history": [
    {
      "id": "uuid",
      "priceType": "default",
      "oldPrice": 150.00,
      "newPrice": 200.00,
      "changedAt": "2024-01-01T00:00:00Z",
      "userId": "uuid"
    }
  ]
}
```

## Browsing Endpoints (Company Only)

### List Suppliers

**GET** `/suppliers`

Get all active suppliers.

**Response:** `200 OK`
```json
{
  "suppliers": [
    {
      "id": "uuid",
      "name": "ABC Suppliers",
      "email": "contact@abc.com",
      "_count": {
        "products": 50
      }
    }
  ]
}
```

### Get Supplier Details

**GET** `/suppliers/:id`

Get detailed information about a supplier.

**Response:** `200 OK`
```json
{
  "supplier": {
    "id": "uuid",
    "name": "ABC Suppliers",
    ...
  }
}
```

### Browse Supplier Products

**GET** `/suppliers/:id/products?page=1&limit=20&category=Steel&search=beam`

Browse a supplier's product catalog.

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Results per page (max 100)
- `category` (string, optional): Filter by category
- `search` (string, optional): Search query

**Response:** `200 OK`
```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "PROD-001",
      "name": "Steel Beam",
      "price": 200.00,
      "priceType": "default",
      "currency": "USD",
      "supplierName": "ABC Suppliers"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Search Products

**GET** `/products/search?q=steel&category=Steel&supplierId=uuid&page=1&limit=20`

Search products across all suppliers.

**Query Parameters:**
- `q` (string, optional): Search query
- `category` (string, optional): Filter by category
- `supplierId` (uuid, optional): Filter by supplier
- `page` (number, optional): Page number
- `limit` (number, optional): Results per page

**Response:** `200 OK`
```json
{
  "products": [...],
  "pagination": {...}
}
```

### Get Product Price

**GET** `/products/:id/price`

Get the price for a specific product (company view).

**Response:** `200 OK`
```json
{
  "price": {
    "value": 200.00,
    "currency": "USD",
    "type": "private",
    "product": {
      "id": "uuid",
      "name": "Steel Beam"
    }
  }
}
```

### Get Product Categories

**GET** `/products/categories`

Get all available product categories.

**Response:** `200 OK`
```json
{
  "categories": ["Steel", "Cement", "Wood", ...]
}
```

## Error Responses

All endpoints may return error responses:

**400 Bad Request**
```json
{
  "error": {
    "message": "Validation failed",
    "statusCode": 400
  }
}
```

**401 Unauthorized**
```json
{
  "error": {
    "message": "Unauthorized",
    "statusCode": 401
  }
}
```

**404 Not Found**
```json
{
  "error": {
    "message": "Resource not found",
    "statusCode": 404
  }
}
```

**500 Internal Server Error**
```json
{
  "error": {
    "message": "Internal server error",
    "statusCode": 500
  }
}
```












