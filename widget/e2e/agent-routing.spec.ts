import { test, expect } from '@playwright/test';

/**
 * E2E tests for Agent Routing (Phase 0)
 * 
 * Tests that agent/tenant routing works correctly:
 * - Agent ID passed via query parameter to API
 * - Different agents have isolated chats
 * - Default agent used when not specified
 * 
 * Note: agentId and orgId are separate concepts:
 * - agentId: the agent identifier passed via ?agent= param
 * - orgId: the organization the agent belongs to (from agent config)
 */
test.describe('Agent Routing', () => {
  test('should create and retrieve chats for default agent', async ({ request }) => {
    // Create a chat for default agent
    const createRes = await request.post('http://localhost:8787/api/chats?agent=default', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Default Agent Test' },
    });
    
    expect(createRes.ok()).toBeTruthy();
    const chat = await createRes.json();
    expect(chat.agentId).toBe('default');
    expect(chat.title).toBe('Default Agent Test');
    
    // Retrieve the chat
    const getRes = await request.get(`http://localhost:8787/api/chats/${chat.id}?agent=default`);
    expect(getRes.ok()).toBeTruthy();
    const retrieved = await getRes.json();
    expect(retrieved.agentId).toBe('default');
  });

  test('should create and retrieve chats for tenant-1 agent', async ({ request }) => {
    // Create a chat for tenant-1 agent
    const createRes = await request.post('http://localhost:8787/api/chats?agent=tenant-1', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Tenant 1 Test' },
    });
    
    expect(createRes.ok()).toBeTruthy();
    const chat = await createRes.json();
    expect(chat.agentId).toBe('tenant-1');
    expect(chat.title).toBe('Tenant 1 Test');
    
    // Retrieve the chat
    const getRes = await request.get(`http://localhost:8787/api/chats/${chat.id}?agent=tenant-1`);
    expect(getRes.ok()).toBeTruthy();
    const retrieved = await getRes.json();
    expect(retrieved.agentId).toBe('tenant-1');
  });

  test('should isolate chats between different agents', async ({ request }) => {
    // Create chats for different agents
    const chat1Res = await request.post('http://localhost:8787/api/chats?agent=tenant-1', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Tenant 1 Isolated' },
    });
    const chat1 = await chat1Res.json();

    const chat2Res = await request.post('http://localhost:8787/api/chats?agent=tenant-2', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Tenant 2 Isolated' },
    });
    const chat2 = await chat2Res.json();

    // List chats for tenant-1 agent
    const list1Res = await request.get('http://localhost:8787/api/chats?agent=tenant-1');
    expect(list1Res.ok()).toBeTruthy();
    const list1 = await list1Res.json();
    
    // List chats for tenant-2 agent
    const list2Res = await request.get('http://localhost:8787/api/chats?agent=tenant-2');
    expect(list2Res.ok()).toBeTruthy();
    const list2 = await list2Res.json();

    // Verify tenant-1 only sees their chats
    expect(list1.chats.every((c: any) => c.agentId === 'tenant-1')).toBe(true);
    expect(list1.chats.some((c: any) => c.id === chat1.id)).toBe(true);
    expect(list1.chats.some((c: any) => c.id === chat2.id)).toBe(false);

    // Verify tenant-2 only sees their chats
    expect(list2.chats.every((c: any) => c.agentId === 'tenant-2')).toBe(true);
    expect(list2.chats.some((c: any) => c.id === chat2.id)).toBe(true);
    expect(list2.chats.some((c: any) => c.id === chat1.id)).toBe(false);
  });

  test('should default to "default" agent when no query param', async ({ request }) => {
    const createRes = await request.post('http://localhost:8787/api/chats', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'No Agent Param' },
    });
    
    expect(createRes.ok()).toBeTruthy();
    const chat = await createRes.json();
    expect(chat.agentId).toBe('default');
  });

  test('should handle empty agent parameter as default', async ({ request }) => {
    const createRes = await request.post('http://localhost:8787/api/chats?agent=', {
      headers: { 'Content-Type': 'application/json' },
      data: { title: 'Empty Agent Param' },
    });
    
    expect(createRes.ok()).toBeTruthy();
    const chat = await createRes.json();
    expect(chat.agentId).toBe('default');
  });
});




