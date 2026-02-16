import { test, expect } from '@playwright/test';

test.describe('Chat list sidebar', () => {
  test('shows auto-created chat and adds a new chat from header button', async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });
    const chats: Array<{
      id: string;
      title: string;
      preview: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    const now = new Date().toISOString();

    await page.route(/.*\/api\/chats(\?.*)?$/, async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
        return;
      }

      if (request.method() === 'POST') {
        const nextId = `chat-${chats.length + 1}`;
        const body = { id: nextId, agentId: 'default', title: 'New Chat' };
        chats.push({
          id: nextId,
          title: body.title,
          preview: '',
          createdAt: now,
          updatedAt: now,
        });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(body),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname.endsWith('/api/chats')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ chats }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route(/.*\/api\/chats\/[^?]+(\?.*)?$/, async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
        return;
      }
      if (request.method() === 'GET') {
        const chatId = request.url().split('/api/chats/')[1]?.split('?')[0] || 'chat-unknown';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            id: chatId,
            messages: [],
            createdAt: now,
            updatedAt: now,
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/');

    await page.waitForLoadState('domcontentloaded');
    const waitForAppMount = async () => {
      await page.waitForFunction(() => {
        const root = document.querySelector('#root');
        return Boolean(root && root.childElementCount > 0);
      }, undefined, { timeout: 30000 });
    };

    let mounted = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await waitForAppMount();
        mounted = true;
        break;
      } catch (error) {
        const optimizeError = pageErrors.find((msg) => msg.includes('Outdated Optimize Dep'));
        if (optimizeError) {
          pageErrors.length = 0;
          await page.waitForTimeout(1500);
          await page.reload();
          continue;
        }
        throw new Error(`App did not mount. Page errors: ${pageErrors.join(' | ') || 'none'}`);
      }
    }

    if (!mounted) {
      throw new Error(`App did not mount. Page errors: ${pageErrors.join(' | ') || 'none'}`);
    }

    const newChatButton = page.getByRole('button', { name: 'New Chat' });
    await expect(newChatButton).toBeVisible();
    expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    await expect(page.getByText('Failed to load conversations')).toHaveCount(0);

    // Open the sidebar (hidden by default)
    const menuButton = page.getByRole('button').filter({ has: page.locator('svg.lucide-menu') });
    await menuButton.click();

    const chatListItem = page.getByRole('listitem').filter({ hasText: 'New Chat' });
    await expect(chatListItem).toHaveCount(1);

    await newChatButton.click();

    await expect(page.getByRole('listitem').filter({ hasText: 'New Chat' })).toHaveCount(2);
  });
});
