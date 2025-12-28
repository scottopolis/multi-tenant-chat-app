# E2E Tests

Playwright end-to-end tests for the dashboard application.

## Setup

First, install Playwright browsers:

```bash
npx playwright install
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

## Test Coverage

- **Navigation**: Landing page → Dashboard
- **Agent Creation**: Create new agent with name and prompt
- **Agent Editing**: Edit existing agent
- **Agent Deletion**: Delete agent with confirmation
- **Cancel Actions**: Cancel create/edit operations

## Notes

- Tests run against `http://localhost:3000`
- The dev server is automatically started before tests run
- Tests use placeholder data until backend integration is complete
