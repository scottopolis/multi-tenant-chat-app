import { internalMutation } from "./_generated/server";

/**
 * Seed script to populate Convex with initial data
 *
 * Run this from the Convex dashboard Functions tab, or via CLI:
 * npx convex run seed:seedInitialData
 */

export const seedInitialData = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting seed...");

    // Create platform tenant
    const platformTenant = await ctx.db.insert("tenants", {
      clerkOrgId: "org_platform",
      name: "Platform",
      plan: "enterprise",
      createdAt: Date.now(),
    });

    console.log("Created platform tenant:", platformTenant);

    // Create Acme Corp tenant
    const acmeTenant = await ctx.db.insert("tenants", {
      clerkOrgId: "org_acme_corp",
      name: "Acme Corporation",
      plan: "pro",
      createdAt: Date.now(),
    });

    console.log("Created Acme Corp tenant:", acmeTenant);

    // Create SimpleBotInc tenant
    const simplebotTenant = await ctx.db.insert("tenants", {
      clerkOrgId: "org_simplebot_inc",
      name: "Simple Bot Inc",
      plan: "free",
      createdAt: Date.now(),
    });

    console.log("Created SimpleBot Inc tenant:", simplebotTenant);

    const now = Date.now();

    // Create default agent
    await ctx.db.insert("agents", {
      agentId: "default",
      tenantId: platformTenant,
      orgId: "platform",
      name: "Default Assistant",
      model: "gpt-4.1-mini",
      langfusePublicKey: "pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56",
      langfuseSecretKey: "sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a",
      langfuseHost: "https://us.cloud.langfuse.com",
      langfusePromptName: "pirate",
      mcpServers: JSON.stringify([
        {
          url: "http://localhost:3030",
          transport: "http",
        },
      ]),
      outputSchema: JSON.stringify({
        type: "object",
        properties: {
          response: { type: "string" },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "2-3 very short suggested follow-up actions or questions the user might want to ask",
          },
        },
        required: ["response", "suggestions"],
      }),
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created default agent");

    // Create acme-support agent
    await ctx.db.insert("agents", {
      agentId: "acme-support",
      tenantId: acmeTenant,
      orgId: "acme-corp",
      name: "Acme Customer Support",
      model: "gpt-4.1-mini",
      langfusePublicKey: "pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56",
      langfuseSecretKey: "sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a",
      langfuseHost: "https://us.cloud.langfuse.com",
      langfusePromptName: "customer-support",
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created acme-support agent");

    // Create acme-sales agent
    await ctx.db.insert("agents", {
      agentId: "acme-sales",
      tenantId: acmeTenant,
      orgId: "acme-corp",
      name: "Acme Sales Assistant",
      model: "claude-3.5-sonnet",
      langfusePublicKey: "pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56",
      langfuseSecretKey: "sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a",
      langfuseHost: "https://us.cloud.langfuse.com",
      langfusePromptName: "sales-assistant",
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created acme-sales agent");

    // Create simplebot-shopping agent
    await ctx.db.insert("agents", {
      agentId: "simplebot-shopping",
      tenantId: simplebotTenant,
      orgId: "simplebot-inc",
      name: "Simple Bot Shopping Assistant",
      systemPrompt: `You are a helpful shopping assistant for Simple Bot Inc.

You help customers find products, answer questions about availability, and provide recommendations.

Be friendly, concise, and always try to upsell related products when appropriate.

If asked about orders or shipping, politely inform the customer to contact support directly.`,
      model: "gpt-4.1-mini",
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created simplebot-shopping agent");

    // Create calendar-extractor agent
    await ctx.db.insert("agents", {
      agentId: "calendar-extractor",
      tenantId: platformTenant,
      orgId: "platform",
      name: "Calendar Event Extractor",
      systemPrompt: "Extract calendar events from the supplied text. Parse dates, times, participants, and event details.",
      model: "gpt-4.1-mini",
      outputSchema: JSON.stringify({
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Event name or title",
                },
                date: {
                  type: "string",
                  description: "Event date in ISO format",
                },
                time: {
                  type: ["string", "null"],
                  description: "Event time if specified",
                },
                participants: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of participants or attendees",
                },
                location: {
                  type: ["string", "null"],
                  description: "Event location if specified",
                },
                description: {
                  type: ["string", "null"],
                  description: "Additional event details",
                },
              },
              required: ["name", "date", "participants"],
            },
          },
        },
        required: ["events"],
      }),
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created calendar-extractor agent");

    // Create support-bot agent
    await ctx.db.insert("agents", {
      agentId: "support-bot",
      tenantId: platformTenant,
      orgId: "platform",
      name: "Support Assistant",
      systemPrompt: `You are a helpful customer support assistant.

Always provide your response in a friendly, concise manner, and include 2-4 relevant suggestions for what the user might want to do next.

Use the 'response' field for your main answer, and 'suggestions' field for quick-reply options.`,
      model: "gpt-4.1-mini",
      outputSchema: JSON.stringify({
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "Your helpful response to the user",
          },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "2-3 suggested follow-up actions or questions the user might want to ask",
          },
        },
        required: ["response", "suggestions"],
      }),
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created support-bot agent");

    console.log("Seed completed successfully!");

    return {
      success: true,
      tenantsCreated: 3,
      agentsCreated: 6,
    };
  },
});

/**
 * Clear all data (for testing)
 * WARNING: This will delete all data!
 */
export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Clearing all data...");

    // Delete all agents
    const agents = await ctx.db.query("agents").collect();
    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    console.log(`Deleted ${agents.length} agents`);

    // Delete all tenants
    const tenants = await ctx.db.query("tenants").collect();
    for (const tenant of tenants) {
      await ctx.db.delete(tenant._id);
    }
    console.log(`Deleted ${tenants.length} tenants`);

    // Delete all API keys
    const apiKeys = await ctx.db.query("apiKeys").collect();
    for (const key of apiKeys) {
      await ctx.db.delete(key._id);
    }
    console.log(`Deleted ${apiKeys.length} API keys`);

    console.log("Clear completed!");

    return {
      success: true,
      deleted: {
        agents: agents.length,
        tenants: tenants.length,
        apiKeys: apiKeys.length,
      },
    };
  },
});
