# Deploying Dashboard to Cloudflare Pages

This guide covers deploying the TanStack Start dashboard to Cloudflare Pages.

## Prerequisites

1. Cloudflare account
2. Wrangler CLI installed (`npm install -g wrangler` or use the local version)
3. Authenticated with Cloudflare (`wrangler login`)

## Quick Deploy

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

## First-Time Setup

### 1. Install Wrangler (if not already installed globally)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### 3. Create a Cloudflare Pages Project

You can create the project via the Cloudflare Dashboard or using Wrangler:

**Option A: Via Dashboard**
1. Go to https://dash.cloudflare.com/
2. Navigate to Pages
3. Click "Create a project"
4. Connect your Git repository
5. Configure build settings:
   - Build command: `npm run build`
   - Build output directory: `.output/public`

**Option B: Via CLI (first deploy)**
```bash
npm run build
wrangler pages deploy .output/public --project-name=chat-assistant-dashboard
```

## Continuous Deployment

### Git Integration (Recommended)

Connect your repository to Cloudflare Pages for automatic deployments:

1. Go to Cloudflare Dashboard → Pages
2. Select your project
3. Click "Settings" → "Builds & deployments"
4. Connect your GitHub/GitLab repository
5. Configure:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `.output/public`
   - **Node version**: `20` (or latest LTS)

Every push to `main` will trigger a production deployment.
Pull requests will create preview deployments automatically.

### Manual Deployment

For manual deployments:

```bash
npm run deploy
```

This will:
1. Build the application with `npm run build`
2. Deploy the `.output/public` directory to Cloudflare Pages

## Environment Variables

If you need environment variables:

1. **Via Dashboard**:
   - Go to Settings → Environment variables
   - Add your variables for Production and Preview environments

2. **Via Wrangler**:
   ```bash
   wrangler pages secret put VARIABLE_NAME
   ```

## Custom Domain

1. Go to your Pages project → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `dashboard.yourdomain.com`)
4. Follow DNS configuration instructions

## Testing Locally

Test the production build locally:

```bash
# Build the app
npm run build

# Preview with Cloudflare Pages development server
npm run pages:dev
```

Visit http://localhost:8788

## Project Configuration

The deployment is configured in:
- **nitro.config.ts**: Configures Nitro with Cloudflare Pages preset
- **package.json**: Deployment scripts

### Build Output

After running `npm run build`, the output structure is:
```
.output/
├── public/           # Static assets (deployed to Pages)
└── server/           # Server functions (Cloudflare Pages Functions)
```

## Troubleshooting

### Build Fails
- Ensure Node.js version is 18+ (check with `node --version`)
- Clear cache: `rm -rf .output node_modules && npm install`

### Deployment Fails
- Check you're logged in: `wrangler whoami`
- Verify build output exists: `ls .output/public`

### Page Not Loading
- Check Cloudflare Pages dashboard for deployment logs
- Verify build output directory is correct: `.output/public`

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Nitro Cloudflare Preset](https://nitro.unjs.io/deploy/providers/cloudflare)
