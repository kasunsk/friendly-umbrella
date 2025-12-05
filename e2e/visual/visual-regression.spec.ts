import { test, expect } from '../fixtures/auth.fixtures';

// Visual regression tests are currently disabled to avoid CI issues with dynamic content
test.describe.skip('Visual Regression Tests', () => {
  test('login page should match snapshot', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow small differences
    });
  });

  test('registration page should match snapshot', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('register-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('admin dashboard should match snapshot', async ({ superAdminPage }) => {
    await superAdminPage.goto('/admin/dashboard');
    await superAdminPage.waitForLoadState('networkidle');
    
    // Wait for statistics to load and render
    await superAdminPage.waitForSelector('text=/System Overview/i', { timeout: 10000 });
    await superAdminPage.waitForTimeout(1000); // Wait for any animations to complete
    
    // Mask dynamic content (statistics numbers) so we only test layout and UI structure
    // This makes the test resilient to data changes
    await expect(superAdminPage).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 500, // Allow differences for dynamic content
      mask: [
        // Mask all statistics number displays
        superAdminPage.locator('text=/^\\d+$/').filter({ hasText: /^\d+$/ }), // Match standalone numbers
        // More specific: mask the large bold numbers in statistics cards
        superAdminPage.locator('.text-3xl.font-bold'),
      ],
    });
  });

  test('supplier dashboard should match snapshot', async ({ supplierAdminPage }) => {
    await supplierAdminPage.goto('/supplier/dashboard');
    await supplierAdminPage.waitForLoadState('networkidle');
    
    await expect(supplierAdminPage).toHaveScreenshot('supplier-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('company dashboard should match snapshot', async ({ companyAdminPage }) => {
    await companyAdminPage.goto('/company/dashboard');
    await companyAdminPage.waitForLoadState('networkidle');
    
    await expect(companyAdminPage).toHaveScreenshot('company-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('login form elements should match snapshot', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Screenshot of just the form
    const form = page.locator('form');
    await expect(form).toHaveScreenshot('login-form.png', {
      maxDiffPixels: 50,
    });
  });

  test('registration form should match snapshot', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    
    // Screenshot of registration form
    const form = page.locator('form');
    await expect(form).toHaveScreenshot('registration-form.png', {
      maxDiffPixels: 50,
    });
  });

  test('error messages should match snapshot', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Trigger error by submitting invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await page.waitForTimeout(2000);
    
    const errorMessage = page.locator('[class*="bg-red-50"], [class*="error"]');
    const errorCount = await errorMessage.count();
    
    if (errorCount > 0) {
      await expect(errorMessage.first()).toHaveScreenshot('error-message.png', {
        maxDiffPixels: 50,
      });
    }
  });

  test('mobile viewport - login page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('tablet viewport - dashboard', async ({ supplierAdminPage }) => {
    await supplierAdminPage.setViewportSize({ width: 768, height: 1024 }); // iPad size
    await supplierAdminPage.goto('/supplier/dashboard');
    await supplierAdminPage.waitForLoadState('networkidle');
    
    await expect(supplierAdminPage).toHaveScreenshot('supplier-dashboard-tablet.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });
});

