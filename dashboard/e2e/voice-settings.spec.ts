import { test, expect } from '@playwright/test'

test.describe('Voice Settings - Edit Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agents')
    await page.getByRole('link', { name: 'Edit' }).first().click()
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()
    
    await page.getByRole('button', { name: 'Voice' }).click()
  })

  test('should display voice settings section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Voice Settings' })).toBeVisible()
    await expect(page.getByText('Enable voice capabilities for this agent')).toBeVisible()
    await expect(page.getByText('Enable voice for this agent')).toBeVisible()
  })

  test('should show voice configuration options when enabled', async ({ page }) => {
    const enableCheckbox = page.getByRole('checkbox', { name: 'Enable voice for this agent' })
    
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.check()
    }

    await expect(page.getByLabel('Model')).toBeVisible()
    await expect(page.getByLabel('Voice', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Locale')).toBeVisible()
    await expect(page.getByText('Allow barge-in (interruptions)')).toBeVisible()
  })

  test('should save voice settings', async ({ page }) => {
    const enableCheckbox = page.getByRole('checkbox', { name: 'Enable voice for this agent' })
    
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.check()
    }

    await page.getByLabel('Voice', { exact: true }).selectOption('alloy')
    await page.getByLabel('Locale').selectOption('es-ES')

    await page.getByRole('button', { name: 'Save Voice Settings' }).click()

    await expect(page.getByText('Voice settings saved successfully')).toBeVisible()
  })

  test('should show integration instructions when voice is enabled', async ({ page }) => {
    const enableCheckbox = page.getByRole('checkbox', { name: 'Enable voice for this agent' })
    
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.check()
      await page.getByRole('button', { name: 'Save Voice Settings' }).click()
      await expect(page.getByText('Voice settings saved successfully')).toBeVisible({ timeout: 10000 })
    }

    await expect(page.locator('h4', { hasText: 'Integration' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Webhook URL')).toBeVisible()
    await expect(page.getByText('/twilio/voice')).toBeVisible()
    await expect(page.getByText('Configure this URL in Twilio Console')).toBeVisible()
  })

  test('should copy webhook URL to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    
    const enableCheckbox = page.getByRole('checkbox', { name: 'Enable voice for this agent' })
    
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.check()
      await page.getByRole('button', { name: 'Save Voice Settings' }).click()
      await expect(page.getByText('Voice settings saved successfully')).toBeVisible()
    }

    await page.getByRole('button', { name: 'Copy' }).click()

    await expect(page.getByText('Webhook URL copied to clipboard')).toBeVisible()
  })
})

test.describe('Voice Settings - Create Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agents/new')
    await expect(page.getByRole('heading', { name: 'Create New Agent' })).toBeVisible()
  })

  test('should show capabilities selector', async ({ page }) => {
    await expect(page.getByText('Capabilities')).toBeVisible()
    await expect(page.getByText('Web Chat')).toBeVisible()
    await expect(page.getByText('Voice')).toBeVisible()
    await expect(page.getByText('You can enable both')).toBeVisible()
  })

  test('should show voice configuration when voice is checked', async ({ page }) => {
    const voiceCheckbox = page.locator('label').filter({ hasText: 'Voice' }).getByRole('checkbox')
    await voiceCheckbox.check()

    await expect(page.getByText('Voice Configuration')).toBeVisible()
    await expect(page.getByLabel('Model')).toBeVisible()
    await expect(page.getByLabel('Voice', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Locale')).toBeVisible()
    await expect(page.getByText('Allow barge-in (interruptions)')).toBeVisible()
  })

  test('should hide voice configuration when voice is unchecked', async ({ page }) => {
    const voiceCheckbox = page.locator('label').filter({ hasText: 'Voice' }).getByRole('checkbox')
    await voiceCheckbox.check()
    await expect(page.getByText('Voice Configuration')).toBeVisible()

    await voiceCheckbox.uncheck()
    await expect(page.getByText('Voice Configuration')).not.toBeVisible()
  })

  test('should allow both web and voice to be selected', async ({ page }) => {
    const webCheckbox = page.locator('label').filter({ hasText: 'Web Chat' }).getByRole('checkbox')
    const voiceCheckbox = page.locator('label').filter({ hasText: 'Voice' }).getByRole('checkbox')

    await expect(webCheckbox).toBeChecked()
    await voiceCheckbox.check()

    await expect(webCheckbox).toBeChecked()
    await expect(voiceCheckbox).toBeChecked()
    await expect(page.getByText('Voice Configuration')).toBeVisible()
  })
})
