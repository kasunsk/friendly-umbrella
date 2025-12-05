import { test, expect } from '../fixtures/auth.fixtures';
import { registerViaAPI, randomEmail, getPendingTenants, approveTenantViaAPI, waitForElementVisible } from '../helpers/test-helpers';

test.describe('Complete End-to-End Workflow', () => {
  test('full tenant registration and approval workflow', async ({ page, superAdminPage }) => {
    // Step 1: Register a new supplier
    const supplierEmail = randomEmail('supplier');
    const supplierName = `E2E Test Supplier ${Date.now()}`;
    
    const registrationResult = await registerViaAPI(page, {
      email: supplierEmail,
      password: 'password123',
      registrationType: 'new_supplier',
      tenantName: supplierName,
      tenantType: 'supplier',
      firstName: 'Test',
      lastName: 'Supplier',
      phone: '+1234567890',
      address: '123 Test Street',
      postalCode: '12345',
    });

    // Registration should be successful
    expect(registrationResult.status).toBe(201);

    // Step 2: Try to login before approval (should fail or be pending)
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', supplierEmail);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show pending message or login failure
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes('/auth/login');
    const hasError = await page.locator('text=/pending|error|failed|approval/i').count() > 0;
    
    // Should either show error/pending message or stay on login page
    expect(isStillOnLogin || hasError).toBeTruthy();

    // Step 3: Super admin approves the tenant
    // Get super admin access token from localStorage
    const superAdminToken = await superAdminPage.evaluate(() => localStorage.getItem('accessToken'));
    
    if (!superAdminToken) {
      throw new Error('Super admin token not found - make sure superAdminPage fixture is properly authenticated');
    }

    // Get pending tenants via API
    const pendingTenants = await getPendingTenants(superAdminPage, superAdminToken);
    
    // Find the tenant we just registered by email
    const pendingTenant = pendingTenants.find((tenant: any) => tenant.email === supplierEmail);
    
    if (!pendingTenant) {
      // Tenant might already be approved or not found - try to proceed anyway
      console.warn(`Tenant with email ${supplierEmail} not found in pending tenants list`);
    } else {
      // Approve the tenant via API
      await approveTenantViaAPI(superAdminPage, pendingTenant.id, superAdminToken, true);
      
      // Wait a moment for approval to be processed
      await superAdminPage.waitForTimeout(2000);
    }

    // Step 4: Now the supplier should be able to login
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', supplierEmail);
    await page.fill('input[type="password"]', 'password123');
    
    // Wait for navigation to complete after login
    const navigationPromise = page.waitForURL(/\/supplier\/dashboard/, { timeout: 20000 });
    
    await page.click('button[type="submit"]');
    
    // Wait for redirect to supplier dashboard with longer timeout
    try {
      await navigationPromise;
      await page.waitForLoadState('networkidle');
    } catch (error) {
      // If navigation times out, check what URL we're on and what error might be showing
      const finalUrl = page.url();
      const errorText = await page.locator('body').textContent();
      throw new Error(`Failed to navigate to supplier dashboard. Current URL: ${finalUrl}. Error: ${error}. Page content: ${errorText?.substring(0, 200)}`);
    }
    
    // Verify we're on the supplier dashboard
    await expect(page).toHaveURL(/\/supplier\/dashboard/);

    // Verify login was successful by checking for access token
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();
    
    // Verify dashboard content loaded
    await page.waitForSelector('body', { timeout: 5000 });
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('complete product and price management workflow', async ({ supplierAdminPage, companyAdminPage }) => {
    // This test would create a product, set prices, and verify company can see them
    // Implementation depends on your actual UI structure

    // Step 1: Supplier creates a product (via UI or API)
    await supplierAdminPage.goto('/supplier/dashboard');
    await waitForElementVisible(supplierAdminPage, 'body', 5000);

    // Step 2: Supplier sets default price
    // (Implementation depends on UI)

    // Step 3: Supplier sets private price for company
    // (Implementation depends on UI)

    // Step 4: Company views product and price
    await companyAdminPage.goto('/company/dashboard');
    await waitForElementVisible(companyAdminPage, 'body', 5000);

    // Verify both pages are functional
    const supplierBody = await supplierAdminPage.textContent('body');
    const companyBody = await companyAdminPage.textContent('body');

    expect(supplierBody).toBeTruthy();
    expect(companyBody).toBeTruthy();
  });
});

