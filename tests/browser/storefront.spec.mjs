import { test, expect } from '@playwright/test';
test('preview loads and gear search is usable',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#browse')).toBeVisible();
 await expect(page.locator('#liveSearch')).toBeVisible();
 await page.locator('#liveSearch').fill('trailer');
 await expect(page.locator('#liveSearch')).toHaveValue('trailer');
 await expect(page.locator('#liveCategory')).toBeVisible();
});
test('dashboard-only tools are not exposed on homepage',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#adminPanel')).toBeHidden();
 await expect(page.locator('#dashboardAdminAction')).toBeHidden();
 await expect(page.locator('#platformFeedbackForm')).toBeHidden();
});
test('website feedback opens in dialog and requires sign in to submit',async({page})=>{
 await page.goto('/');
 await page.locator('#openPlatformFeedback').click();
 await expect(page.locator('#accountPopup')).toBeVisible();
 await expect(page.locator('#platformFeedbackForm')).toBeVisible();
 await page.locator('#platformFeedbackForm textarea[name="review"]').fill('Please add a more detailed location filter.');
 await page.locator('#platformFeedbackForm button[type="submit"]').click();
 await expect(page.locator('#platformFeedbackStatus')).toContainText('Please sign in');
});
