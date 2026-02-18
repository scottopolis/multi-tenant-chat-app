# Testing Phases: Minimum Coverage Plan

## Goal
Add the smallest set of unit and E2E tests needed to cover the project's major features (chat creation, listing, messaging, and widget UX).

## Phases
### Phase 1: Worker Chat API Unit Coverage
- [x] Add unit tests for core chat API endpoints (`/api/chats`, `/api/chats/:id`, `/api/chats/:id/messages`) using in-memory storage.
- [x] Verify request validation and message handling entrypoint.
- [x] Run worker unit tests (`cd worker && npm test`).

### Phase 2: Widget E2E Chat List Coverage
- [ ] Add a Playwright E2E test for the chat list/sidebar behavior (auto-created chat appears, new chat button creates another entry).
- [ ] Run the new Playwright test (`cd widget && npx playwright test e2e/chat-list.spec.ts`).

## Status Log
- Phase 1: Completed (worker tests currently failing in `worker/src/agents/structured-output.test.ts`)
- Phase 2: Not started
