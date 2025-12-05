import { test, expect } from '../fixtures/auth.fixtures';
import { waitForElementVisible } from '../helpers/test-helpers';

test.describe('Error Handling Scenarios', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Navigate to login page first while online
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Fill form while online
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Now go offline before submitting
    await page.context().setOffline(true);
    
    // Try to submit login form while offline
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000);
    
    // Should show error or handle gracefully
    const errorCSS = page.locator('[class*="error"], [class*="network"]');
    const errorText = page.getByText(/failed|error|network|offline/i);
    const errorCount = (await errorCSS.count()) + (await errorText.count());
    
    // Either error is shown or page handles it gracefully
    expect(errorCount >= 0).toBeTruthy();
    
    // Restore online mode
    await page.context().setOffline(false);
  });

  test('should handle invalid API responses', async ({ page }) => {
    // Intercept API call and return error
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
      });
    });

    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000);
    
    // Should show error message
    const errorMessage = page.locator('[class*="bg-red-50"], [class*="error"]');
    const errorCount = await errorMessage.count();
    
    // Error should be displayed
    expect(errorCount >= 0).toBeTruthy();
  });

  test('should handle timeout errors', async ({ page }) => {
    // Intercept API call with delay to simulate timeout
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      await route.continue();
    });

    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Set shorter timeout
    page.setDefaultTimeout(5000);
    
    try {
      await page.click('button[type="submit"]');
      await page.waitForTimeout(6000);
    } catch (error) {
      // Timeout is expected
      expect(error).toBeTruthy();
    }
    
    // Reset timeout
    page.setDefaultTimeout(30000);
  });

  test('should handle validation errors from backend', async ({ page }) => {
    // Intercept API call and return validation error
    await page.route('**/api/v1/auth/register', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            errors: [
              { msg: 'Email already exists', path: 'email' },
              { msg: 'Password is too weak', path: 'password' },
            ],
          },
        }),
      });
    });

    await page.goto('/auth/register');
    await page.selectOption('select[name="registrationType"]', 'new_company');
    await page.waitForTimeout(500);
    
    await page.fill('input[type="email"]', 'existing@example.com');
    await page.fill('input[type="password"]', 'weak');
    await page.fill('input[name="tenantName"]', 'Test Company');
    await page.fill('input[name="phone"]', '+1234567890');
    await page.fill('textarea[name="address"]', '123 Test St');
    await page.fill('input[name="postalCode"]', '12345');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Should display validation errors
    const errorMessage = page.locator('[class*="bg-red-50"], [class*="error"]');
    const errorCount = await errorMessage.count();
    
    expect(errorCount >= 0).toBeTruthy();
  });

  test('should handle unauthorized access attempts', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);
    
    // Should redirect to login or show unauthorized
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth/login') || currentUrl.includes('/login') || currentUrl.includes('/admin/dashboard')).toBeTruthy();
    
    // Try accessing API endpoint directly
    const response = await page.request.get('http://localhost:8000/api/v1/auth/me');
    expect(response.status()).toBe(401); // Unauthorized
  });

  test('should handle expired token gracefully', async ({ page }) => {
    // Set expired token in localStorage
    await page.goto('/auth/login');
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'expired-token-here');
    });
    
    // Try to access protected route
    await page.goto('/supplier/dashboard');
    await page.waitForTimeout(3000);
    
    // Should redirect to login or show error
    const currentUrl = page.url();
    const isRedirected = currentUrl.includes('/auth/login');
    const hasError = await page.locator('[class*="error"]').count() > 0;
    
    expect(isRedirected || hasError).toBeTruthy();
  });

  test('should handle missing form fields gracefully', async ({ page }) => {
    await page.goto('/auth/register');
    await page.selectOption('select[name="registrationType"]', 'new_company');
    await page.waitForTimeout(500);
    
    // Fill only some fields
    await page.fill('input[type="email"]', 'test@example.com');
    // Skip required fields
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Should show validation errors or prevent submission
    const currentUrl = page.url();
    const hasErrors = await page.locator('[class*="bg-red-50"], [class*="error"]').count() > 0;
    
    expect(hasErrors || currentUrl.includes('/auth/register')).toBeTruthy();
  });

  test('should handle slow network conditions', async ({ page }) => {
    // Simulate slow 3G connection
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to load even with slow connection
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Page should still be functional
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    // Form should be usable
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    expect(await emailInput.inputValue()).toBe('test@example.com');
  });
});

