import { Page, expect } from '@playwright/test';

/**
 * Wait for backend API to be ready
 */
export async function waitForBackendReady(page: Page, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await page.request.get('http://localhost:8000/health');
      if (response.ok()) {
        return;
      }
    } catch (error) {
      // Backend not ready yet
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Backend did not become ready in time');
}

/**
 * Wait for frontend to be ready
 */
export async function waitForFrontendReady(page: Page, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 5000 });
      return;
    } catch (error) {
      // Frontend not ready yet
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Frontend did not become ready in time');
}

/**
 * Generate a random email for testing
 */
export function randomEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@e2e-test.com`;
}

/**
 * Generate a random string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Fill login form
 */
export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
}

/**
 * Submit login form
 */
export async function submitLoginForm(page: Page): Promise<void> {
  await page.click('button[type="submit"]');
}

/**
 * Wait for navigation after login
 */
export async function waitForLoginSuccess(page: Page, expectedPath: string): Promise<void> {
  await page.waitForURL(new RegExp(expectedPath), { timeout: 10000 });
}

/**
 * Check if element is visible and wait for it
 */
export async function waitForElementVisible(page: Page, selector: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Check if element contains text
 */
export async function expectElementContainsText(page: Page, selector: string, text: string): Promise<void> {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page: Page, url: string, method = 'GET'): Promise<any> {
  const response = await page.waitForResponse(
    (response) => response.url().includes(url) && response.request().method() === method,
    { timeout: 10000 }
  );
  return response.json();
}

/**
 * Get text content of element
 */
export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  return await page.locator(selector).textContent();
}

/**
 * Check if user is logged in by checking localStorage
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!localStorage.getItem('accessToken');
  });
}

/**
 * Logout user
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

/**
 * Register a new tenant via API
 */
export async function registerViaAPI(
  page: Page,
  registrationData: {
    email: string;
    password: string;
    registrationType: 'new_supplier' | 'new_company';
    tenantName?: string;
    tenantType?: 'supplier' | 'company';
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
  }
): Promise<{ status: number; body: any }> {
  const response = await page.request.post('http://localhost:8000/api/v1/auth/register', {
    data: {
      email: registrationData.email,
      password: registrationData.password,
      registrationType: registrationData.registrationType,
      tenantName: registrationData.tenantName || `${registrationData.tenantType || 'supplier'} Test`,
      tenantType: registrationData.tenantType || 'supplier',
      firstName: registrationData.firstName || 'Test',
      lastName: registrationData.lastName || 'User',
      phone: registrationData.phone || '+1234567890',
      address: registrationData.address || '123 Test St',
      postalCode: registrationData.postalCode || '12345',
    },
  });

  return {
    status: response.status(),
    body: await response.json().catch(() => ({})),
  };
}

/**
 * Get pending tenants (requires super admin authentication)
 */
export async function getPendingTenants(page: Page, accessToken: string): Promise<any[]> {
  const response = await page.request.get('http://localhost:8000/api/v1/admin/tenants/pending', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to get pending tenants: ${response.status()}`);
  }

  const data = await response.json();
  return data.tenants || [];
}

/**
 * Approve a tenant via API (requires super admin authentication)
 */
export async function approveTenantViaAPI(
  page: Page,
  tenantId: string,
  accessToken: string,
  approved: boolean = true,
  reason?: string
): Promise<any> {
  const response = await page.request.post(`http://localhost:8000/api/v1/admin/tenants/${tenantId}/approve`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      approved,
      reason,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to approve tenant: ${response.status()}`);
  }

  return await response.json();
}

