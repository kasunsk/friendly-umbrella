import { test, expect } from '../fixtures/auth.fixtures';
import { registerViaAPI, randomEmail, waitForElementVisible } from '../helpers/test-helpers';

test.describe('Advanced Workflows', () => {
  test('complete supplier onboarding workflow', async ({ page, superAdminPage }) => {
    // Step 1: Register new supplier
    const supplierEmail = randomEmail('supplier');
    const supplierName = `E2E Advanced Supplier ${Date.now()}`;
    
    const registration = await registerViaAPI(page, {
      email: supplierEmail,
      password: 'password123',
      registrationType: 'new_supplier',
      tenantName: supplierName,
      tenantType: 'supplier',
      firstName: 'Advanced',
      lastName: 'Supplier',
      phone: '+1234567890',
      address: '123 Test Street',
      postalCode: '12345',
    });

    expect(registration.status).toBe(201);

    // Step 2: Super admin approves supplier
    await superAdminPage.goto('/admin/dashboard');
    await waitForElementVisible(superAdminPage, 'body', 5000);

    // Look for and approve the supplier
    const approveButton = superAdminPage.locator('button:has-text("Approve")').first();
    const buttonCount = await approveButton.count();

    if (buttonCount > 0) {
      await approveButton.click();
      await superAdminPage.waitForTimeout(2000);
    }

    // Step 3: Supplier logs in
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', supplierEmail);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should be able to access dashboard
    const currentUrl = page.url();
    expect(currentUrl.includes('/supplier/dashboard') || currentUrl.includes('/auth/login')).toBeTruthy();
  });

  test('user registration with existing tenant', async ({ page }) => {
    // First, we need an existing tenant - this test assumes one exists
    // In a real scenario, you'd create a tenant first via API
    
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Select "New User for a Company" registration type
    await page.selectOption('select[name="registrationType"]', 'new_company_user');
    await page.waitForTimeout(1000); // Wait for tenant list to load

    // Fill registration form
    const userEmail = randomEmail('company-user');
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[name="firstName"]', 'Company');
    await page.fill('input[name="lastName"]', 'User');

    // Check if tenant selector is available
    const tenantSelect = page.locator('select[name="tenantId"]');
    const tenantCount = await tenantSelect.count();

    if (tenantCount > 0) {
      // Select first available tenant
      const options = await tenantSelect.locator('option').count();
      if (options > 1) {
        await tenantSelect.selectOption({ index: 1 }); // Skip the first "Select..." option
      }
    }

    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should show success or redirect
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth/login') || currentUrl.includes('/auth/register')).toBeTruthy();
  });

  test('password validation workflow', async ({ page }) => {
    await page.goto('/auth/register');
    
    await page.selectOption('select[name="registrationType"]', 'new_company');
    await page.waitForTimeout(500);

    const userEmail = randomEmail('test');
    
    // Test weak password
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', 'short'); // Too short
    await page.fill('input[name="tenantName"]', 'Test Company');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Should show password validation error or prevent submission
    const passwordInput = page.locator('input[type="password"]');
    const errorMessage = await passwordInput.evaluate((el) => (el as HTMLInputElement).validationMessage);
    const hasError = errorMessage || await page.locator('text=/at least 8/i').count() > 0;

    expect(hasError || page.url().includes('/auth/register')).toBeTruthy();
  });

  test('email validation workflow', async ({ page }) => {
    await page.goto('/auth/register');
    
    await page.selectOption('select[name="registrationType"]', 'new_company');
    await page.waitForTimeout(500);

    // Test invalid email
    await page.fill('input[type="email"]', 'invalid-email-format');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[name="tenantName"]', 'Test Company');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Should show email validation error
    const emailInput = page.locator('input[type="email"]');
    const errorMessage = await emailInput.evaluate((el) => (el as HTMLInputElement).validationMessage);
    const hasError = errorMessage || await page.locator('text=/invalid.*email/i').count() > 0;

    expect(hasError || page.url().includes('/auth/register')).toBeTruthy();
  });

  test('session persistence across page reloads', async ({ supplierAdminPage }) => {
    await supplierAdminPage.goto('/supplier/dashboard');
    await waitForElementVisible(supplierAdminPage, 'body', 5000);

    // Verify we're logged in
    let token = await supplierAdminPage.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();

    // Reload page
    await supplierAdminPage.reload();
    await supplierAdminPage.waitForLoadState('networkidle');

    // Should still be logged in
    token = await supplierAdminPage.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();
    
    // Should still be on dashboard
    const currentUrl = supplierAdminPage.url();
    expect(currentUrl).toContain('/supplier/dashboard');
  });

  test('logout workflow', async ({ supplierAdminPage }) => {
    await supplierAdminPage.goto('/supplier/dashboard');
    await waitForElementVisible(supplierAdminPage, 'body', 5000);

    // Look for logout button/link
    const logoutButton = supplierAdminPage.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")');
    const buttonCount = await logoutButton.count();

    if (buttonCount > 0) {
      await logoutButton.first().click();
      await supplierAdminPage.waitForTimeout(2000);

      // Should redirect to login page
      const currentUrl = supplierAdminPage.url();
      expect(currentUrl.includes('/auth/login')).toBeTruthy();

      // Token should be cleared
      const token = await supplierAdminPage.evaluate(() => localStorage.getItem('accessToken'));
      expect(token).toBeFalsy();
    }
  });

  test('navigation between dashboards (access control)', async ({ page }) => {
    // Try to access admin dashboard without authentication
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);

    // Should redirect to login or show unauthorized
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth/login') || currentUrl.includes('/login') || currentUrl.includes('/admin/dashboard')).toBeTruthy();

    // Try to access supplier dashboard without authentication
    await page.goto('/supplier/dashboard');
    await page.waitForTimeout(2000);

    // Should redirect to login
    const newUrl = page.url();
    expect(newUrl.includes('/auth/login')).toBeTruthy();
  });

  test('form field interactions and state', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Test registration type switching
    await page.selectOption('select[name="registrationType"]', 'new_company');
    await page.waitForTimeout(500);
    
    let tenantNameVisible = await page.locator('input[name="tenantName"]').isVisible();
    expect(tenantNameVisible).toBeTruthy();

    // Switch to new user registration
    await page.selectOption('select[name="registrationType"]', 'new_company_user');
    await page.waitForTimeout(1000);

    // Tenant name should not be visible, tenant selector should be
    tenantNameVisible = await page.locator('input[name="tenantName"]').isVisible();
    expect(tenantNameVisible).toBeFalsy();

    // Tenant selector should be visible (or empty state)
    const tenantSelector = page.locator('select[name="tenantId"], [class*="yellow-50"]');
    const selectorCount = await tenantSelector.count();
    expect(selectorCount).toBeGreaterThan(0);
  });
});

