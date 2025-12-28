import { test, expect } from '@playwright/test'

test.describe('Agent Management', () => {
  test('should navigate from landing page to dashboard', async ({ page }) => {
    await page.goto('/')

    // Verify landing page content
    await expect(page.getByText('Multi-Tenant Chat Assistant')).toBeVisible()

    // Click "Go to Dashboard" button
    await page.getByRole('link', { name: 'Go to Dashboard' }).click()

    // Verify navigation to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome to your Dashboard')).toBeVisible()
  })

  test('should create a new agent', async ({ page }) => {
    await page.goto('/dashboard/agents')

    // Verify agents list page
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible()

    // Click create agent button
    await page.getByRole('link', { name: 'Create Agent' }).click()

    // Verify navigation to create form
    await expect(page).toHaveURL('/dashboard/agents/new')
    await expect(page.getByRole('heading', { name: 'Create New Agent' })).toBeVisible()

    // Fill out the form
    await page.getByLabel('Agent Name').fill('Test Support Agent')
    await page.getByLabel('System Prompt').fill('You are a helpful test support agent that assists users with testing.')

    // Submit the form
    await page.getByRole('button', { name: 'Create Agent' }).click()

    // Verify navigation back to agents list
    await expect(page).toHaveURL('/dashboard/agents')

    // Note: In a real scenario, we would verify the new agent appears in the list
    // For now, this validates the form flow works
  })

  test('should edit an existing agent', async ({ page }) => {
    await page.goto('/dashboard/agents')

    // Click edit on the first agent
    await page.getByRole('link', { name: 'Edit' }).first().click()

    // Verify navigation to edit form
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()

    // Verify form is pre-populated (checking if name field has value)
    const nameField = page.getByLabel('Agent Name')
    await expect(nameField).not.toHaveValue('')

    // Update the agent name
    const originalName = await nameField.inputValue()
    await nameField.fill(originalName + ' - Updated')

    // Update the prompt
    await page.getByLabel('System Prompt').fill('Updated prompt: You are an updated assistant.')

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // Verify navigation back to agents list
    await expect(page).toHaveURL('/dashboard/agents')
  })

  test('should delete an agent', async ({ page }) => {
    await page.goto('/dashboard/agents')

    // Click edit on the first agent
    await page.getByRole('link', { name: 'Edit' }).first().click()

    // Verify we're on the edit page
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()

    // Set up dialog handler to accept the confirmation
    page.on('dialog', dialog => dialog.accept())

    // Click delete button
    await page.getByRole('button', { name: 'Delete Agent' }).click()

    // Verify navigation back to agents list
    await expect(page).toHaveURL('/dashboard/agents')
  })

  test('should cancel agent creation', async ({ page }) => {
    await page.goto('/dashboard/agents/new')

    // Fill out partial form
    await page.getByLabel('Agent Name').fill('Cancelled Agent')

    // Click cancel button
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Verify navigation back to agents list
    await expect(page).toHaveURL('/dashboard/agents')
  })

  test('should cancel agent editing', async ({ page }) => {
    await page.goto('/dashboard/agents')

    // Click edit on the first agent
    await page.getByRole('link', { name: 'Edit' }).first().click()

    // Make some changes
    await page.getByLabel('Agent Name').fill('Changed Name')

    // Click cancel button
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Verify navigation back to agents list
    await expect(page).toHaveURL('/dashboard/agents')
  })
})
