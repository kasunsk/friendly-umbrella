# Supplier Price Management Flow

Complete guide on how suppliers manage product prices in the Construction Pricing Platform.

## Overview

Suppliers can manage two types of prices for their products:

1. **Default Prices** - Visible to all companies
2. **Private Prices** - Company-specific negotiated prices (overrides default)

## Price Management Architecture

### Database Structure

```
Product
├── DefaultPrice (one-to-many)
│   └── Visible to ALL companies
└── PrivatePrice (one-to-many)
    └── Visible to SPECIFIC company only
```

### Price Priority

When a company views a product:
1. **First Check**: Private price for that company (if exists)
2. **Fallback**: Default price (if no private price)
3. **Result**: Company sees the best available price

## Current Flow

### 1. Setting Default Price

#### Flow Diagram
```
Supplier → Select Product → Set/Update Default Price → All Companies See New Price
```

#### Step-by-Step Process

**Step 1: Supplier Creates/Selects Product**
- Product must exist in supplier's catalog
- Product can be created via `/api/v1/products` endpoint

**Step 2: Set Default Price**
- **API Endpoint**: `PUT /api/v1/products/:productId/default-price`
- **Request Body**:
  ```json
  {
    "price": 150.00,
    "currency": "USD",
    "effectiveFrom": "2024-01-01T00:00:00Z",  // Optional
    "effectiveUntil": null                      // Optional
  }
  ```

**Step 3: Backend Processing**
1. Verify product belongs to supplier
2. Get current active default price (if exists)
3. If price changed:
   - Deactivate old price (`isActive = false`)
   - Create new price entry
4. Create audit log entry
5. Broadcast WebSocket update to all companies

**Step 4: Result**
- All companies can now see this default price
- Price appears in product search results
- Real-time update via WebSocket

#### Example: Setting Default Price

```bash
# Set default price for a product
PUT /api/v1/products/{productId}/default-price
Authorization: Bearer {supplier_token}

{
  "price": 200.00,
  "currency": "USD"
}

# Response
{
  "defaultPrice": {
    "id": "uuid",
    "productId": "uuid",
    "price": 200.00,
    "currency": "USD",
    "effectiveFrom": "2024-11-30T10:00:00Z",
    "isActive": true
  }
}
```

### 2. Setting Private Price

#### Flow Diagram
```
Supplier → Select Product → Select Company → Set Private Price → Only That Company Sees Special Price
```

#### Step-by-Step Process

**Step 1: Supplier Identifies Company**
- Supplier needs the company's UUID
- Can get from `/api/v1/suppliers` endpoint (if company is registered)

**Step 2: Create Private Price**
- **API Endpoint**: `POST /api/v1/products/:productId/private-prices`
- **Request Body**:
  ```json
  {
    "companyId": "company-uuid",
    "price": 180.00,
    "currency": "USD",
    "effectiveFrom": "2024-01-01T00:00:00Z",  // Optional
    "effectiveUntil": null,                    // Optional
    "notes": "Volume discount for preferred customer"  // Optional
  }
  ```

**Step 3: Backend Processing**
1. Verify product belongs to supplier
2. Verify company exists and is active
3. Deactivate existing private price for this product-company combination
4. Create new private price entry
5. Create audit log entry
6. Broadcast WebSocket update to specific company

**Step 4: Result**
- Only the specified company sees this private price
- Other companies still see default price
- Company gets real-time notification via WebSocket

#### Example: Creating Private Price

```bash
# Create private price for a specific company
POST /api/v1/products/{productId}/private-prices
Authorization: Bearer {supplier_token}

{
  "companyId": "company-uuid",
  "price": 175.00,
  "currency": "USD",
  "notes": "Special rate for volume purchase"
}

# Response
{
  "privatePrice": {
    "id": "uuid",
    "productId": "uuid",
    "companyId": "company-uuid",
    "price": 175.00,
    "currency": "USD",
    "notes": "Special rate for volume purchase",
    "isActive": true
  }
}
```

### 3. Updating Prices

#### Update Default Price
- **Endpoint**: `PUT /api/v1/products/:productId/default-price`
- **Process**: Same as setting, but deactivates old price and creates new one
- **Audit**: Full history maintained

#### Update Private Price
- **Endpoint**: `PUT /api/v1/private-prices/:privatePriceId`
- **Process**: Updates existing private price
- **Audit**: Logs price changes

#### Example: Updating Private Price

```bash
PUT /api/v1/private-prices/{privatePriceId}
Authorization: Bearer {supplier_token}

{
  "price": 170.00,
  "notes": "Updated discount rate"
}
```

### 4. Viewing Price Information

#### List Private Prices for Product
- **Endpoint**: `GET /api/v1/products/:productId/private-prices`
- **Returns**: All active private prices for a product with company details

#### View Price History
- **Endpoint**: `GET /api/v1/products/:productId/price-history`
- **Returns**: Audit log of all price changes (last 100)

#### Example: Viewing Private Prices

```bash
GET /api/v1/products/{productId}/private-prices
Authorization: Bearer {supplier_token}

# Response
{
  "privatePrices": [
    {
      "id": "uuid",
      "companyId": "company-uuid",
      "price": 175.00,
      "currency": "USD",
      "company": {
        "id": "company-uuid",
        "name": "ABC Construction",
        "email": "contact@abc.com"
      }
    }
  ]
}
```

## Complete Workflow Example

### Scenario: Supplier Managing Prices for "Steel Beam"

**Step 1: Create Product**
```bash
POST /api/v1/products
{
  "sku": "STEEL-BEAM-001",
  "name": "Steel Beam 10x10",
  "unit": "piece",
  "category": "Steel"
}
```

**Step 2: Set Default Price**
```bash
PUT /api/v1/products/{productId}/default-price
{
  "price": 200.00,
  "currency": "USD"
}
```
→ All companies see: **$200.00**

**Step 3: Create Private Price for Company A**
```bash
POST /api/v1/products/{productId}/private-prices
{
  "companyId": "company-a-uuid",
  "price": 180.00,
  "currency": "USD",
  "notes": "Preferred customer discount"
}
```
→ Company A sees: **$180.00** (private price)
→ Other companies see: **$200.00** (default price)

**Step 4: Create Private Price for Company B**
```bash
POST /api/v1/products/{productId}/private-prices
{
  "companyId": "company-b-uuid",
  "price": 190.00,
  "currency": "USD"
}
```
→ Company A sees: **$180.00**
→ Company B sees: **$190.00**
→ Other companies see: **$200.00**

**Step 5: Update Default Price**
```bash
PUT /api/v1/products/{productId}/default-price
{
  "price": 210.00,
  "currency": "USD"
}
```
→ Company A sees: **$180.00** (unchanged - private price)
→ Company B sees: **$190.00** (unchanged - private price)
→ Other companies see: **$210.00** (updated default)

## Key Features

### 1. Price History & Audit Trail

Every price change is logged:
- Old price
- New price
- Who changed it
- When it changed
- IP address and user agent
- Change reason

### 2. Time-Based Pricing

Prices can have effective dates:
- `effectiveFrom`: When price becomes active
- `effectiveUntil`: When price expires (null = never expires)

### 3. Soft Deletes

- Prices are never hard deleted
- Set `isActive = false` to deactivate
- Maintains full history

### 4. Real-Time Updates

- WebSocket broadcasts price changes
- Companies get instant notifications
- No page refresh needed

### 5. Price Priority Logic

```javascript
// Pseudo-code for price selection
function getPriceForCompany(productId, companyId) {
  // 1. Check for active private price
  privatePrice = getPrivatePrice(productId, companyId);
  if (privatePrice && isActive(privatePrice)) {
    return privatePrice;
  }
  
  // 2. Fallback to default price
  defaultPrice = getDefaultPrice(productId);
  if (defaultPrice && isActive(defaultPrice)) {
    return defaultPrice;
  }
  
  // 3. No price available
  return null;
}
```

## API Endpoints Summary

### Default Prices (Supplier Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/v1/products/:id/default-price` | Update/create default price |
| GET | `/api/v1/products/:id/price-history` | View price change history |

### Private Prices (Supplier Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products/:id/private-prices` | Create private price |
| GET | `/api/v1/products/:id/private-prices` | List all private prices |
| PUT | `/api/v1/private-prices/:id` | Update private price |
| DELETE | `/api/v1/private-prices/:id` | Delete private price (soft) |

## Best Practices

### 1. Default Price Strategy
- Set competitive default prices
- Update regularly based on market conditions
- Use effective dates for planned price changes

### 2. Private Price Strategy
- Offer discounts for volume buyers
- Reward loyal customers
- Negotiate long-term contracts
- Document reasons in `notes` field

### 3. Price Management
- Review price history regularly
- Monitor which companies have private prices
- Update prices proactively
- Maintain audit trail for compliance

### 4. Performance
- Prices are indexed for fast queries
- WebSocket updates are efficient
- Price lookups are optimized

## Current Limitations

1. **No Bulk Price Updates**: Must update prices one by one
2. **No Price Templates**: Cannot save price configurations
3. **No Scheduled Price Changes**: Must set effective dates manually
4. **No Price Approval Workflow**: Changes are immediate

## Future Enhancements

- Bulk price import/export
- Price templates and presets
- Scheduled price changes
- Price approval workflows
- Price comparison tools
- Automated price suggestions












