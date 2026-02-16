const { test, expect } = require('@playwright/test');

test('smoke', async ({ page }) => {
  await page.goto('data:text/html,<title>ok</title><h1>ok</h1>');
  await expect(page.locator('h1')).toHaveText('ok');
});
