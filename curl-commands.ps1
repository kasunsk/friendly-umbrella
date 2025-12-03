# Working cURL Commands for Backend API Testing
# Base URL: http://localhost:8000

# ============================================
# AUTHENTICATION APIs
# ============================================

# 1. Register Supplier
Write-Host "`n1. Register Supplier" -ForegroundColor Green
curl.exe -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d "@test-register.json"

# 2. Register Company
Write-Host "`n2. Register Company" -ForegroundColor Green
$companyBody = @'
{
  "tenantName": "Test Company Inc",
  "tenantType": "company",
  "email": "testcompany@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Company"
}
'@
$companyBody | Out-File -FilePath test-company-register.json -Encoding utf8
curl.exe -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d "@test-company-register.json"

# 3. Login Supplier
Write-Host "`n3. Login Supplier" -ForegroundColor Green
$loginBody = @'
{
  "email": "testsupplier@example.com",
  "password": "password123"
}
'@
$loginBody | Out-File -FilePath test-login.json -Encoding utf8
curl.exe -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d "@test-login.json"

# Note: Replace YOUR_ACCESS_TOKEN with actual token from login response
# 4. Get Current User
Write-Host "`n4. Get Current User (Replace YOUR_ACCESS_TOKEN)" -ForegroundColor Yellow
# curl.exe -X GET http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# ============================================
# PRODUCT APIs (Supplier Only)
# ============================================

# 5. Create Product
Write-Host "`n5. Create Product (Replace YOUR_ACCESS_TOKEN)" -ForegroundColor Yellow
$productBody = @'
{
  "sku": "PROD-001",
  "name": "Steel Beam 10x10",
  "description": "High-quality steel beam for construction",
  "category": "Steel",
  "unit": "piece",
  "defaultPrice": 150.00,
  "currency": "USD"
}
'@
$productBody | Out-File -FilePath test-product.json -Encoding utf8
# curl.exe -X POST http://localhost:8000/api/v1/products -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -H "Content-Type: application/json" -d "@test-product.json"

# 6. List Products
Write-Host "`n6. List Products (Replace YOUR_ACCESS_TOKEN)" -ForegroundColor Yellow
# curl.exe -X GET http://localhost:8000/api/v1/products -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 7. Get Product Stats
Write-Host "`n7. Get Product Stats (Replace YOUR_ACCESS_TOKEN)" -ForegroundColor Yellow
# curl.exe -X GET http://localhost:8000/api/v1/products/stats -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# ============================================
# PRICE APIs (Supplier Only)
# ============================================

# 8. Update Default Price
Write-Host "`n8. Update Default Price (Replace YOUR_ACCESS_TOKEN and PRODUCT_ID)" -ForegroundColor Yellow
$priceBody = @'
{
  "price": 200.00,
  "currency": "USD",
  "effectiveFrom": "2024-01-01T00:00:00Z",
  "effectiveUntil": null
}
'@
$priceBody | Out-File -FilePath test-price.json -Encoding utf8
# curl.exe -X PUT http://localhost:8000/api/v1/products/PRODUCT_ID/default-price -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -H "Content-Type: application/json" -d "@test-price.json"

# ============================================
# SUPPLIER BROWSING APIs (Company Only)
# ============================================

# 9. List Suppliers
Write-Host "`n9. List Suppliers (Replace YOUR_ACCESS_TOKEN)" -ForegroundColor Yellow
# curl.exe -X GET http://localhost:8000/api/v1/suppliers -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

Write-Host "`n=== All JSON files created. Use them with curl -d `"@filename.json`" ===" -ForegroundColor Cyan











