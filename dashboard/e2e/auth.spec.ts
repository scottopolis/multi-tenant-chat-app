import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('landing page shows sign-in button when not authenticated', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Multi-Tenant Chat Assistant')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In to Get Started' })).toBeVisible()
  })

  test('protected route shows sign-in when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')

    // Should show Clerk sign-in component instead of dashboard content
    await expect(page.locator('.cl-signIn-root')).toBeVisible({ timeout: 5000 })
  })

  test('header shows sign-in button when not authenticated', async ({ page }) => {
    await page.goto('/')

    // Header should have sign-in button
    const header = page.locator('header')
    await expect(header.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })
})
