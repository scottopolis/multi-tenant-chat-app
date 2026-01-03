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
    await page.goto('/?agent=test-tenant-123');
    
    // Wait for the app to load
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    // The widget should have loaded with the agent from URL
    // We can verify by checking the API calls include the agent param
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/chats') && 
      request.url().includes('agent=test-tenant-123')
    );
    
    // Wait for the chat creation request
    await requestPromise;
  });

  test('uses default agent when no URL param provided', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    // Verify API calls use default agent
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/chats') && 
      request.url().includes('agent=default')
    );
    
    await requestPromise;
  });

  test('handles URL-encoded agent IDs', async ({ page }) => {
    await page.goto('/?agent=my%20tenant');
    
    await page.waitForSelector('text=Chat Assistant', { timeout: 10000 });
    
    const requestPromise = page.waitForRequest((request) => 
      request.url().includes('/api/chats') && 
      (request.url().includes('agent=my%20tenant') || request.url().includes('agent=my+tenant'))
    );
    
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
});
