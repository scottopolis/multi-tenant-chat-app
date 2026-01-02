# Deployment Guide

Deploy your chat assistant to production.

## Prerequisites

- Cloudflare account
- OpenRouter API key
- Domain name (optional, for custom domain)

## Worker Deployment

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### 3. Configure Secrets

Set your production secrets:

```bash
cd worker

# Required
wrangler secret put OPENROUTER_API_KEY

# Optional (for Langfuse)
wrangler secret put LANGFUSE_SECRET_KEY
wrangler secret put LANGFUSE_PUBLIC_KEY
wrangler secret put LANGFUSE_HOST
```

### 4. Deploy

```bash
cd worker
npm run deploy
```

You'll see output like:

```
Published chat-assistant-api (0.1.0)
  https://chat-assistant-api.your-username.workers.dev
```

**Save this URL** - you'll need it for the widget configuration.

### 5. Custom Domain (Optional)

In `wrangler.toml`, add:

```toml
routes = [
  { pattern = "api.yourdomain.com", custom_domain = true }
]
```

Then deploy again:

```bash
npm run deploy
```

## Widget Deployment

### Option 1: Cloudflare Pages

#### 1. Update Environment Variables

Create `widget/.env.production`:

```bash
VITE_API_URL=https://chat-assistant-api.your-username.workers.dev
```

Or use your custom domain:

```bash
VITE_API_URL=https://api.yourdomain.com
```

#### 2. Build

```bash
cd widget
npm run build
```

#### 3. Deploy to Pages

```bash
npx wrangler pages deploy dist --project-name chat-assistant-widget
```

Your widget will be available at:
```
https://chat-assistant-widget.pages.dev
```

#### 4. Custom Domain for Widget

In Cloudflare dashboard:
1. Go to Pages → chat-assistant-widget
2. Click "Custom domains"
3. Add your domain (e.g., `chat.yourdomain.com`)

### Option 2: Vercel

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Deploy

```bash
cd widget
vercel
```

Follow the prompts. When asked about environment variables, add:

```
VITE_API_URL=https://chat-assistant-api.your-username.workers.dev
```

### Option 3: Netlify

#### 1. Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### 2. Build and Deploy

```bash
cd widget
npm run build
netlify deploy --prod --dir=dist
```

Set environment variable in Netlify dashboard:
```
VITE_API_URL=https://chat-assistant-api.your-username.workers.dev
```

## Environment-Specific Configuration

### Staging Environment

Create staging deployment in `wrangler.toml`:

```toml
[env.staging]
name = "chat-assistant-api-staging"
```

Deploy to staging:

```bash
wrangler deploy --env staging
```

### Production Best Practices

1. **Use separate API keys** for development and production
2. **Enable monitoring** in Cloudflare dashboard
3. **Set up alerts** for high error rates or usage spikes
4. **Use custom domains** for professional appearance
5. **Implement rate limiting** (add to worker when ready)

## Database Migration

When moving from in-memory storage to persistent storage:

### Option 1: Cloudflare D1

1. **Create database:**

```bash
wrangler d1 create chat-assistant-db
```

2. **Update `wrangler.toml`:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "chat-assistant-db"
database_id = "your-database-id"
```

3. **Update storage.ts** to use D1 instead of Maps

### Option 2: Convex

1. Sign up at [convex.dev](https://www.convex.dev)
2. Install Convex: `npm install convex`
3. Update storage layer to use Convex client
4. Add `CONVEX_DEPLOYMENT` to secrets

### Option 3: Turso

1. Sign up at [turso.tech](https://turso.tech)
2. Install Turso client: `npm install @libsql/client`
3. Update storage layer
4. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to secrets

## Monitoring

### Cloudflare Analytics

View metrics in Cloudflare dashboard:
- Request volume
- Error rates
- Response times
- Geographic distribution

### Custom Logging

Add structured logging to worker:

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Chat created',
  chatId,
  orgId,
}));
```

View logs:

```bash
wrangler tail
```

### Error Tracking

Consider integrating:
- **Sentry** for error tracking
- **LogFlare** for log aggregation
- **Datadog** for comprehensive monitoring

## Backup and Recovery

### Export Data

Create a backup endpoint:

```typescript
app.get('/admin/export', async (c) => {
  // Authenticate admin user
  const data = {
    chats: Array.from(chats.values()),
    messages: Array.from(messages.entries()),
  };
  return c.json(data);
});
```

### Import Data

Create an import endpoint for restoration.

## Performance Optimization

### Worker

- Use Cloudflare caching for static responses
- Minimize external API calls
- Optimize tool execution

### Widget

- Enable code splitting in Vite
- Compress images and assets
- Use CDN for static files (built-in with CF Pages)

### OpenRouter

- Choose appropriate models for tasks
- Set reasonable token limits
- Monitor API usage and costs

## Security Checklist

- [ ] API keys stored as secrets (not in code)
- [ ] CORS properly configured per org
- [ ] Authentication implemented (before production)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Webhook signatures verified
- [ ] HTTPS enforced everywhere
- [ ] Secrets rotated regularly

## Scaling Considerations

As your usage grows:

1. **Implement persistent storage** to avoid data loss
2. **Add authentication** for multi-tenant isolation
3. **Set up rate limiting** per org/user
4. **Monitor costs** on OpenRouter and Cloudflare
5. **Add caching** for repeated queries
6. **Consider regional routing** for global users

## Rollback Procedure

If deployment has issues:

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rolling back due to issue"
```

## Next Steps

- Set up monitoring and alerts
- Implement authentication
- Add persistent storage
- Configure custom domains
- Test thoroughly in staging before production




