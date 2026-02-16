/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: __dirname,
  testMatch: '*.spec.js',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    headless: true,
  },
};
