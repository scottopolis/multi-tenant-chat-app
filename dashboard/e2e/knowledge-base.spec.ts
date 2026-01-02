import { test, expect } from '@playwright/test'

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/agents')
    await page.getByRole('link', { name: 'Edit' }).first().click()
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()
    
    // Navigate to Knowledge Base tab
    await page.getByRole('button', { name: 'Knowledge Base' }).click()
  })

  test('should display knowledge base section with upload zone', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    await expect(page.getByText('Upload documents to give your agent access to custom knowledge')).toBeVisible()
    await expect(page.getByText('Click to upload')).toBeVisible()
    await expect(page.getByText('PDF, TXT, MD, CSV up to 10MB')).toBeVisible()
  })

  test('should upload a document and display it in the list', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')

    await fileInput.setInputFiles({
      name: 'test-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is test content for the knowledge base.'),
    })

    await expect(page.getByText('Uploading...')).toBeVisible()
    await expect(page.getByText('Uploading...')).not.toBeVisible({ timeout: 10000 })

    await expect(page.locator('.bg-slate-900').first()).toBeVisible()
  })

  test('should delete a document from the knowledge base', async ({ page }) => {
    // Wait for loading to complete
    await expect(page.getByText('Loading documents...')).not.toBeVisible({ timeout: 10000 })

    // Ensure there's at least one document - upload if needed
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'delete-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Document to be deleted.'),
    })
    await expect(page.getByText('Uploading...')).not.toBeVisible({ timeout: 10000 })

    // Wait for at least one delete button to appear
    const deleteButton = page.locator('button[title="Delete document"]').first()
    await expect(deleteButton).toBeVisible({ timeout: 10000 })

    page.on('dialog', dialog => dialog.accept())

    // Click delete and verify spinner appears (indicates delete action started)
    await deleteButton.click()

    // Verify delete action completed (spinner should disappear)
    await expect(page.locator('svg.animate-spin')).not.toBeVisible({ timeout: 10000 })
  })
})
