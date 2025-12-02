# Company User Guide

Complete guide for companies using the Construction Pricing Platform.

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Browsing Suppliers](#browsing-suppliers)
3. [Searching Products](#searching-products)
4. [Viewing Prices](#viewing-prices)
5. [Best Practices](#best-practices)

## Dashboard Overview

The Company Dashboard provides tools to find and compare construction materials from various suppliers.

### Key Features

- **Supplier Directory**: Browse all available suppliers
- **Product Search**: Search across all suppliers
- **Price Comparison**: Compare prices from different suppliers
- **Real-Time Updates**: Get notified of price changes

## Browsing Suppliers

### Step 1: View Supplier List

1. Navigate to your dashboard
2. Click "Browse Suppliers" or use the API endpoint
3. View the list of all active suppliers

### Step 2: Supplier Information

Each supplier listing shows:
- **Company Name**: Supplier's business name
- **Contact Email**: Supplier's email address
- **Phone**: Contact number
- **Address**: Business address
- **Product Count**: Number of active products

### Step 3: View Supplier Catalog

1. Click on a supplier to view details
2. Browse their product catalog
3. Filter by category or search within catalog

## Searching Products

### Basic Search

1. Use the search bar on the dashboard
2. Enter product name, SKU, or description
3. Results show products from all suppliers

### Advanced Search

**Using API:**
```bash
GET /api/v1/products/search?q=steel&category=Steel&supplierId={supplierId}
```

**Search Parameters:**
- **q**: Search query (product name, SKU, description)
- **category**: Filter by product category
- **supplierId**: Filter by specific supplier
- **page**: Page number for pagination
- **limit**: Results per page (max 100)

### Search Results

Results include:
- **Product Name**: Full product name
- **SKU**: Product identifier
- **Supplier**: Supplier name
- **Price**: Current price (default or private)
- **Price Type**: "default" or "private"
- **Currency**: Price currency

## Viewing Prices

### Price Types

#### Default Prices
- Visible to all companies
- Set by suppliers
- Standard pricing

#### Private Prices
- Company-specific pricing
- Override default prices
- Negotiated agreements
- Shown automatically if available

### Price Display

When viewing products, you'll see:
- **Current Price**: The price you'll pay (private if available, otherwise default)
- **Currency**: Price currency
- **Price Type**: Indicates if it's a private or default price

## Viewing Supplier Details

### Product Details View

When viewing products in the table, you can see detailed supplier contact information:

#### Step 1: Click "View Details"
1. Find the product you're interested in
2. Click the **"View Details"** button in the Actions column
3. The product row expands inline to show supplier information

#### Step 2: View Supplier Contact Information

The expanded details show:
- **Phone Number**: Supplier's contact phone number (if available)
- **Location**: Supplier's business address (if available)

#### Step 3: Collapse Details
1. Click the **"Hide Details"** button to collapse the expanded row
2. The details section closes, returning to the normal table view

### Benefits

- Quick access to supplier contact information
- No need to navigate away from the product list
- Easy comparison between different suppliers
- Inline expansion keeps context of your current view

### Getting Product Price

**Using API:**
```bash
GET /api/v1/products/{productId}/price
```

Response includes:
- Current price (private or default)
- Currency
- Price type
- Effective dates (if applicable)

## Best Practices

### Supplier Selection

1. **Research Suppliers**
   - Review supplier profiles
   - Check product catalogs
   - Compare pricing

2. **Build Relationships**
   - Contact suppliers for private pricing
   - Negotiate volume discounts
   - Establish long-term agreements

### Product Search

1. **Use Specific Terms**
   - Search by exact product name
   - Use SKU when known
   - Include category in search

2. **Filter Effectively**
   - Use category filters
   - Filter by supplier
   - Combine multiple filters

### Price Comparison

1. **Compare Across Suppliers**
   - Check multiple suppliers
   - Consider total cost (including shipping)
   - Factor in quality and reliability

2. **Request Private Pricing**
   - Contact suppliers directly
   - Negotiate based on volume
   - Establish preferred supplier status

### Ordering Process

1. **Verify Prices**
   - Check current prices before ordering
   - Confirm currency
   - Verify price type (private vs default)

2. **Contact Suppliers**
   - Use provided contact information
   - Confirm availability
   - Finalize order details

## Troubleshooting

### No Suppliers Showing
- Check if you're logged in
- Verify your account type is "Company"
- Refresh the page

### Search Not Working
- Check your search query
- Try different search terms
- Clear filters and search again

### Price Not Displayed
- Product may not have a price set
- Contact supplier for pricing
- Check if you have private pricing available

### Price Different Than Expected
- Verify you're viewing the correct product
- Check if private pricing applies
- Confirm currency is correct

## Next Steps

- Learn about [API Testing](./api-testing.md) for programmatic access
- Review [Supplier Guide](./supplier-guide.md) to understand supplier features
- Check [Technical Documentation](../technical/) for integration details








