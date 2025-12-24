# Testing Guide

This project follows a minimal testing strategy focused on critical business logic and user flows.

## Testing Philosophy

As specified in the PLAN.md:
- **Unit tests** (Vitest): Only for complex business logic, as few as possible
- **E2E tests** (Playwright): Only for major user functionality and flows, not too many
- **Evals**: Will be used later to test LLM responses

## Setup Complete ✅

### Worker (Backend)
- ✅ TypeScript type checking configured
- ✅ Vitest unit tests configured
- ✅ 2 unit tests for storage logic (multi-tenancy & message lifecycle)

### Widget (Frontend)
- ✅ TypeScript type checking configured  
- ✅ Vitest unit tests configured
- ✅ Playwright E2E tests configured
- ✅ 2 E2E tests for critical user flows

## Running Tests

### Type Checking

```bash
# Worker type checking
cd worker && npm run type-check

# Widget type checking
cd widget && npm run type-check
```

### Unit Tests

```bash
# Worker unit tests
cd worker && npm test              # Watch mode
cd worker && npm test -- --run     # Run once

# Widget unit tests (when added)
cd widget && npm test              # Watch mode
cd widget && npm test -- --run     # Run once
```

### E2E Tests

```bash
# Widget E2E tests
cd widget && npm run test:e2e           # Headless
cd widget && npm run test:e2e:ui        # Interactive UI mode
```

**Note:** E2E tests require both worker and widget to be running. The Playwright config automatically starts the widget dev server, but you need to start the worker manually:

```bash
# Terminal 1: Start worker
cd worker && npm run dev

# Terminal 2: Run E2E tests
cd widget && npm run test:e2e
```

## Current Test Coverage

### Worker Unit Tests (`worker/src/storage.test.ts`)

**Focus:** Multi-tenant chat storage logic

✅ **Test 1: Multi-tenant chat isolation**
- Verifies chats are properly isolated by organization
- Tests that org-123 and org-456 have separate chat lists

✅ **Test 2: Message lifecycle**
- Tests full flow: create chat → add messages → retrieve
- Verifies message format conversion for AI SDK
- Tests error handling for non-existent chats

### Widget E2E Tests (`widget/e2e/chat.spec.ts`)

**Focus:** Critical user journeys

✅ **Test 1: Full chat flow**
- Load interface
- Send message "What is 2 + 2?"
- Verify streaming indicator appears
- Verify assistant response arrives
- Verify input state management (disabled while sending, re-enabled after)

✅ **Test 2: Multi-turn conversation with tools**
- Test calculator tool: "What is 5 times 7?"
- Test time tool: "What time is it?"
- Verify both messages appear in conversation
- Verify tool responses are displayed

## What We DON'T Test

Following the minimal testing philosophy, we intentionally skip:

❌ Simple utility functions (e.g., date formatting)
❌ UI component rendering (covered by E2E tests)
❌ Tool implementations (simple logic, tested via E2E)
❌ API client methods (tested via E2E)
❌ Styling and layout details
❌ LLM response quality (will use evals later)

## Adding New Tests

### When to Add Unit Tests
Only add unit tests for:
- Complex business logic
- Data transformation logic
- Edge cases in core functionality
- Multi-tenant isolation logic

### When to Add E2E Tests
Only add E2E tests for:
- New critical user flows
- Major feature additions
- Integration points between systems

### When NOT to Test
Skip testing:
- Simple getters/setters
- Pure UI components (unless critical)
- Trivial helper functions
- Already covered by E2E tests

## CI/CD Integration (TODO)

```yaml
# Example GitHub Actions workflow
- name: Type Check
  run: npm run type-check

- name: Unit Tests
  run: npm test -- --run

- name: E2E Tests
  run: npm run test:e2e
```

## Future: LLM Evals

Once the core functionality is stable, add:
- Response quality evaluation
- Tool calling accuracy tests
- Multi-turn conversation coherence
- Prompt effectiveness testing

Use tools like:
- Langfuse Evals
- OpenAI Evals
- Custom eval scripts

---

**Last Updated:** December 24, 2025

