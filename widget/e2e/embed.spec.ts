import { test, expect } from '@playwright/test';

/**
 * E2E tests for Widget Embed functionality
 * 
 * Tests that the widget properly:
 * - Reads agent ID from URL params
 * - Detects embedded state
 * - Handles postMessage protocol
 */

test.describe('Widget URL Parameter Routing', () => {
  test('reads agent from ?agent= URL param', async ({ page }) => {
    // Start listening for requests before navigation
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/') && 
      request.url().includes('agent=test-tenant-123')
    );
    
    await page.goto('/?agent=test-tenant-123');
    
    // Wait for the app to load
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    // Wait for the request with correct agent param
    await requestPromise;
  });

  test('uses default agent when no URL param provided', async ({ page }) => {
    // Start listening for requests before navigation
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/') && 
      request.url().includes('agent=default')
    );
    
    await page.goto('/');
    
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    // Verify API calls use default agent
    await requestPromise;
  });

  test('handles URL-encoded agent IDs', async ({ page }) => {
    // Start listening for requests before navigation
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/') && 
      (request.url().includes('agent=my%20tenant') || request.url().includes('agent=my+tenant'))
    );
    
    await page.goto('/?agent=my%20tenant');
    
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    await requestPromise;
  });
});

test.describe('Embed Script Integration', () => {
  test('embed.js is served from public directory', async ({ page }) => {
    const response = await page.goto('/embed.js');
    expect(response?.status()).toBe(200);
    
    const content = await response?.text();
    expect(content).toContain('mychat-widget');
    expect(content).toContain('data-agent-id');
  });

  test('embed.js contains required configuration attributes', async ({ page }) => {
    const response = await page.goto('/embed.js');
    const content = await response?.text();
    
    // Check all supported data attributes
    expect(content).toContain('data-agent-id');
    expect(content).toContain('data-color');
    expect(content).toContain('data-position');
    expect(content).toContain('data-icon');
  });

  test('embed.js contains postMessage protocol implementation', async ({ page }) => {
    const response = await page.goto('/embed.js');
    const content = await response?.text();
    
    // Check postMessage types from spec
    expect(content).toContain('WIDGET_READY');
    expect(content).toContain('REQUEST_CLOSE');
    expect(content).toContain('INIT');
    expect(content).toContain('OPEN');
    expect(content).toContain('CLOSE');
  });

  test('embed.js creates launcher and iframe elements', async ({ page }) => {
    const response = await page.goto('/embed.js');
    const content = await response?.text();
    
    expect(content).toContain('mychat-widget-launcher');
    expect(content).toContain('mychat-widget-iframe');
    expect(content).toContain('mychat-widget-container');
  });

  test('embed.js supports auto-open via chat=open URL param', async ({ page }) => {
    const response = await page.goto('/embed.js');
    const content = await response?.text();
    
    expect(content).toContain("urlParams.get('chat')");
    expect(content).toContain("'open'");
  });
});

test.describe('Embed Script Launcher Integration', () => {
  test('creates test page with embed script and launcher appears', async ({ page }) => {
    // Create a minimal HTML page that uses the embed script
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Test Customer Site</h1>
          <script 
            src="http://localhost:5173/embed.js" 
            data-agent-id="e2e-test-agent"
            data-color="#FF5733"
            data-position="bottom-right"
          ></script>
        </body>
      </html>
    `);

    // Wait for the launcher button to be created
    const launcher = page.locator('#mychat-widget-launcher');
    await expect(launcher).toBeVisible({ timeout: 5000 });
    
    // Verify launcher has correct styling
    const bgColor = await launcher.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('rgb(255, 87, 51)'); // #FF5733 in rgb
  });

  test('launcher toggles iframe visibility on click', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Test Customer Site</h1>
          <script 
            src="http://localhost:5173/embed.js" 
            data-agent-id="e2e-test-agent"
          ></script>
        </body>
      </html>
    `);

    const launcher = page.locator('#mychat-widget-launcher');
    const container = page.locator('#mychat-widget-container');
    
    await expect(launcher).toBeVisible({ timeout: 5000 });
    
    // Initially iframe container should be hidden
    await expect(container).toHaveCSS('display', 'none');
    
    // Click launcher to open
    await launcher.click();
    await expect(container).toHaveCSS('display', 'block');
    
    // Click launcher again to close
    await launcher.click();
    await expect(container).toHaveCSS('display', 'none');
  });

  test('iframe has correct agent ID in URL', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <script 
            src="http://localhost:5173/embed.js" 
            data-agent-id="my-custom-agent"
          ></script>
        </body>
      </html>
    `);

    // Wait for launcher first (confirms embed.js loaded)
    await page.waitForSelector('#mychat-widget-launcher', { timeout: 5000 });
    
    // Iframe exists but is hidden - use state: 'attached' instead of waiting for visibility
    const iframe = page.locator('#mychat-widget-iframe');
    await expect(iframe).toBeAttached();
    
    const src = await iframe.getAttribute('src');
    expect(src).toContain('agent=my-custom-agent');
  });

  test('bottom-left position is applied correctly', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <script 
            src="http://localhost:5173/embed.js" 
            data-agent-id="test-agent"
            data-position="bottom-left"
          ></script>
        </body>
      </html>
    `);

    const launcher = page.locator('#mychat-widget-launcher');
    await expect(launcher).toBeVisible({ timeout: 5000 });
    
    // Check that left is set (not right)
    const left = await launcher.evaluate((el) => getComputedStyle(el).left);
    expect(left).toBe('24px');
  });
});
