import type { Id } from "./_generated/dataModel";

type Identity = { subject: string };

export function assertIdentity(identity: Identity | null): Identity {
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
}

export function assertUserMatches(identity: Identity, clerkUserId: string): void {
  if (identity.subject !== clerkUserId) {
    throw new Error("Forbidden");
  }
}

export function assertTenantAccess(
  identityTenantId: Id<"tenants">,
  targetTenantId: Id<"tenants">
): void {
  if (identityTenantId !== targetTenantId) {
    throw new Error("Forbidden");
  }
}

export async function requireIdentity(
  ctx: { auth: { getUserIdentity: () => Promise<Identity | null> } }
): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  return assertIdentity(identity);
}

export async function requireTenantForIdentity(
  ctx: {
    auth: { getUserIdentity: () => Promise<Identity | null> };
    db: {
      query: (table: "tenants") => {
        withIndex: (
          index: "by_clerk_user",
          fn: (q: { eq: (field: "clerkUserId", value: string) => unknown }) => unknown
        ) => { first: () => Promise<{ _id: Id<"tenants">; clerkUserId?: string } | null> };
      };
    };
  }
): Promise<{ _id: Id<"tenants">; clerkUserId?: string }> {
  const identity = await requireIdentity(ctx);
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
    .first();

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}
