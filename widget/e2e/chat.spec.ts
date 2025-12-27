import { test, expect } from '@playwright/test';

/**
 * E2E tests for major user flows
 * Focus: Critical user journeys, not exhaustive coverage
 */
test.describe('Chat Widget', () => {
  test('should complete full chat flow: load, send message, receive streaming response', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the input to be ready
    const input = page.getByPlaceholder(/Type a message/i);
    await expect(input).toBeVisible();
    
    // Type and send a message
    await input.fill('What is 2 + 2?');
    await input.press('Enter');
    
    // Verify input is cleared
    await expect(input).toHaveValue('');
    
    // Verify the user message appears
    await expect(page.getByText('What is 2 + 2?')).toBeVisible();
    
    // Wait for assistant response to appear
    await expect(page.locator('[data-role="assistant"]')).toBeVisible({ timeout: 15000 });
    
    // Verify input is re-enabled after response
    await expect(input).toBeEnabled();
    await expect(input).toHaveAttribute('placeholder', 'Type a message...');
  });

  test('should handle multi-turn conversation with tool usage', async ({ page }) => {
    await page.goto('/');
    
    const input = page.getByPlaceholder(/Type a message/i);
    await expect(input).toBeVisible();
    
    // First message - should trigger calculator tool
    await input.fill('What is 5 times 7?');
    await input.press('Enter');
    await page.waitForTimeout(3000);
    
    // Second message - should trigger time tool
    await input.fill('What time is it?');
    await input.press('Enter');
    await page.waitForTimeout(3000);
    
    // Verify both messages are in the conversation
    await expect(page.getByText('What is 5 times 7?')).toBeVisible();
    await expect(page.getByText('What time is it?')).toBeVisible();
    
    // Verify we have multiple assistant responses
    const assistantMessages = page.locator('[data-role="assistant"]');
    await expect(assistantMessages).toHaveCount(2, { timeout: 10000 });
  });
});

