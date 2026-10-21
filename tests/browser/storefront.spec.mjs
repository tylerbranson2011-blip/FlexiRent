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

test('published listing shows photos and complete details',async({page})=>{
 await page.route('**/rest/v1/listings?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',owner_id:'22222222-2222-4222-8222-222222222222',title:'16-foot utility trailer',description:'Full trailer description and pickup instructions',category:'trailer',city:'Hazard',state:'KY',zip_code:'41701',price_per_day:45,image_url:'https://photos.test/cover.jpg',status:'published'}])}));
 await page.route('**/rest/v1/listing_photos?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{listing_id:'11111111-1111-4111-8111-111111111111',image_url:'https://photos.test/cover.jpg',position:0},{listing_id:'11111111-1111-4111-8111-111111111111',image_url:'https://photos.test/side.jpg',position:1}])}));
 await page.goto('/');
 await expect(page.locator('.live-listing')).toHaveCount(1);
 await expect(page.locator('.live-listing img')).toHaveAttribute('src','https://photos.test/cover.jpg');
 await page.getByRole('button',{name:'View all photos & details'}).click();
 await expect(page.locator('#listingDetails')).toBeVisible();
 await expect(page.locator('#listingDetailsInfo')).toContainText('Full trailer description and pickup instructions');
 await expect(page.locator('#listingDetailsInfo')).toContainText('41701');
 await expect(page.locator('#listingDetailsPhotos .owner-detail-thumb')).toHaveCount(2);
 await page.getByRole('button',{name:'Show listing photo 2'}).click();
 await expect(page.locator('#listingDetailsPhotos .owner-detail-hero')).toHaveAttribute('src','https://photos.test/side.jpg');
});
