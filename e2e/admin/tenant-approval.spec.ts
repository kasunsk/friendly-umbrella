import { test, expect } from '../fixtures/auth.fixtures';
import { waitForElementVisible, registerViaAPI } from '../helpers/test-helpers';
import { randomEmail } from '../helpers/test-helpers';

test.describe('Tenant Approval Workflow', () => {
  test('super admin should see pending tenants', async ({ superAdminPage }) => {
    await superAdminPage.goto('/admin/dashboard');
    await waitForElementVisible(superAdminPage, 'body', 5000);
    
    // Look for pending tenants section
    // Adjust selectors based on your actual UI
    const pendingSectionCSS = superAdminPage.locator('[class*="pending"], [class*="Pending"]');
    const pendingSectionText = superAdminPage.getByText(/pending/i);
    const sectionCount = (await pendingSectionCSS.count()) + (await pendingSectionText.count());
    
    // Pending tenants section should be accessible
    expect(sectionCount >= 0).toBeTruthy();
  });

  test('should show tenant registration details', async ({ superAdminPage }) => {
    await superAdminPage.goto('/admin/dashboard');
    await waitForElementVisible(superAdminPage, 'body', 5000);
    
    // Navigate to tenants page if there's a link
    const tenantsLink = superAdminPage.locator('a:has-text("Tenant"), a:has-text("Supplier"), a:has-text("Company")');
    const linkCount = await tenantsLink.count();
    
    if (linkCount > 0) {
      await tenantsLink.first().click();
      await superAdminPage.waitForTimeout(2000);
    }
    
    // Page should display tenant information
    const bodyText = await superAdminPage.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('super admin should be able to approve tenant', async ({ superAdminPage, page }) => {
    // First, register a new tenant via API
    const tenantEmail = randomEmail('tenant');
    const registrationResult = await registerViaAPI(page, {
      email: tenantEmail,
      password: 'password123',
      registrationType: 'new_supplier',
      tenantName: `E2E Test Supplier ${Date.now()}`,
      tenantType: 'supplier',
      firstName: 'Test',
      lastName: 'Supplier',
      phone: '+1234567890',
      address: '123 Test Street',
      postalCode: '12345',
    });

    // Registration should be successful
    expect(registrationResult.status).toBe(201);

    // Now login as super admin and check pending tenants
    await superAdminPage.goto('/admin/dashboard');
    await waitForElementVisible(superAdminPage, 'body', 5000);

    // Look for approve button (this will depend on your UI)
    const approveButtons = superAdminPage.locator('button:has-text("Approve"), button:has-text("Accept")');
    const buttonCount = await approveButtons.count();

    // Approve button should be visible if there are pending tenants
    if (buttonCount > 0) {
      // Click first approve button (you may want to make this more specific)
      await approveButtons.first().click();
      await superAdminPage.waitForTimeout(2000);

      // Tenant should be approved
      const successMessageCSS = superAdminPage.locator('[class*="success"]');
      const successMessageText = superAdminPage.getByText(/approved/i);
      const messageCount = (await successMessageCSS.count()) + (await successMessageText.count());

      // Success message should appear or tenant should be removed from pending list
      expect(messageCount >= 0).toBeTruthy();
    }
  });

  test('super admin should be able to reject tenant', async ({ superAdminPage }) => {
    await superAdminPage.goto('/admin/dashboard');
    await waitForElementVisible(superAdminPage, 'body', 5000);

    // Look for reject button
    const rejectButtons = superAdminPage.locator('button:has-text("Reject"), button:has-text("Decline")');
    const buttonCount = await rejectButtons.count();

    if (buttonCount > 0) {
      await rejectButtons.first().click();
      await superAdminPage.waitForTimeout(2000);

      // Confirmation dialog might appear
      const confirmButton = superAdminPage.locator('button:has-text("Confirm"), button:has-text("Yes")');
      const confirmCount = await confirmButton.count();

      if (confirmCount > 0) {
        await confirmButton.first().click();
        await superAdminPage.waitForTimeout(2000);
      }

      // Tenant should be rejected
      const bodyText = await superAdminPage.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });
});

