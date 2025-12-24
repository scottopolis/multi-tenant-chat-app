# Development Guide

Best practices and workflows for developing the chat assistant.

## Development Setup

### Environment Variables

**Worker (`worker/.dev.vars` - create this file):**
```bash
OPENROUTER_API_KEY=your_key_here
LANGFUSE_SECRET_KEY=optional
LANGFUSE_PUBLIC_KEY=optional
LANGFUSE_HOST=optional
```

**Widget (`widget/.env`):**
```bash
VITE_API_URL=http://localhost:8787
```

### Running in Development

**Terminal 1 - Worker:**
```bash
cd worker
npm run dev
```

**Terminal 2 - Widget:**
```bash
cd widget
npm run dev
```

## Project Structure

```
worker/src/
├── index.ts           # Main API routes (Hono app)
├── storage.ts         # In-memory data storage
├── agents/
│   └── index.ts       # Agent runner logic
└── tools/
    ├── index.ts       # Tool registry
    ├── builtin.ts     # Built-in tools
    └── webhook.ts     # Webhook tool factory

widget/src/
├── App.tsx            # Root component
├── main.tsx           # Entry point
├── components/
│   ├── Chat.tsx       # Main chat container
│   ├── Message.tsx    # Individual message
│   ├── MessageList.tsx
│   ├── MessageInput.tsx
│   └── ui/            # Base UI components
├── hooks/
│   └── useChat.ts     # Chat state management
└── lib/
    ├── api.ts         # API client
    └── utils.ts       # Utilities
```

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
# Worker tests
cd worker
npm test

# Widget tests
cd widget
npm test
```

### E2E Tests

Run end-to-end tests with Playwright:

```bash
cd widget
npm run test:e2e
```

Create E2E tests in `widget/e2e/`:

```typescript
// widget/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('user can send a message', async ({ page }) => {
  await page.goto('/');
  
  await page.fill('input[placeholder="Type a message..."]', 'Hello!');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=Hello!')).toBeVisible();
});
```

## Code Style

### TypeScript

- Use explicit types for function parameters and return values
- Prefer interfaces for object shapes
- Use `const` over `let` when possible

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Naming Conventions

- **Files**: `kebab-case.ts` or `PascalCase.tsx` for components
- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE` for config values

## Common Tasks

### Adding a New API Endpoint

1. **Add route in `worker/src/index.ts`:**

```typescript
app.get('/api/my-endpoint', async (c) => {
  const orgId = c.get('orgId');
  // Your logic here
  return c.json({ data: 'response' });
});
```

2. **Add client function in `widget/src/lib/api.ts`:**

```typescript
export async function getMyData(): Promise<MyData> {
  const response = await fetch(`${API_URL}/api/my-endpoint`);
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
}
```

3. **Use in component with TanStack Query:**

```typescript
const { data } = useQuery({
  queryKey: ['myData'],
  queryFn: getMyData,
});
```

### Adding a New UI Component

1. **Create component file:**

```typescript
// widget/src/components/MyComponent.tsx
interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}
```

2. **Use in parent component:**

```typescript
import { MyComponent } from './MyComponent';

<MyComponent title="Hello" />
```

### Modifying the Agent Behavior

Edit `worker/src/agents/index.ts`:

- Change `DEFAULT_SYSTEM_PROMPT` for different personality
- Modify `DEFAULT_MODEL` for different default model
- Adjust `maxSteps` in `streamText` for tool use limits

## Debugging

### Worker Logs

Worker logs appear in the terminal where you ran `npm run dev`:

```typescript
console.log('Debug info:', data);
console.error('Error occurred:', error);
```

### Widget Debugging

Use browser DevTools:

1. **Console**: View logs and errors
2. **Network**: Inspect API calls and SSE streams
3. **React DevTools**: Inspect component state

### Common Issues

**"Unauthorized" errors:**
- Check that auth middleware is properly bypassed in dev
- Verify API URL in widget `.env`

**SSE not working:**
- Check Network tab for EventStream connection
- Verify CORS headers in worker
- Ensure `Content-Type: text/event-stream` is set

**TypeScript errors:**
- Run `npm run build` to see all type errors
- Check that types are properly imported

## Performance Optimization

### Worker

- Keep functions pure and stateless
- Avoid blocking operations in request handlers
- Use appropriate OpenRouter models for the task

### Widget

- Memoize expensive computations with `useMemo`
- Prevent unnecessary re-renders with `React.memo`
- Lazy load components with `React.lazy`

## Git Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test thoroughly
4. Commit with clear messages: `git commit -m "Add feature X"`
5. Push and create a pull request

## Next Steps

- [Deployment Guide](./deployment.md) - Deploy to production
- [API Reference](./api-reference.md) - API documentation
- [Tools & Agents](./tools-agents.md) - Customize agents and tools

