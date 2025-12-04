# Test Data Files

This folder contains JSON test data files used for API testing with cURL commands.

## Files

- `test-register.json` - Supplier registration test data
- `test-register-new.json` - New supplier registration test data
- `test-register-fresh.json` - Fresh supplier registration test data
- `test-company-register.json` - Company registration test data
- `test-login.json` - Login test data
- `test-login-existing.json` - Login with existing account test data
- `test-product.json` - Product creation test data
- `test-price.json` - Price update test data

## Usage

These files are used with cURL commands for testing the API. Example:

```bash
curl.exe -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "@test-data/test-register.json"
```

## Note

These are example test files. Update the values as needed for your testing scenarios.












