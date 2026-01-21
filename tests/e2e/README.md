# E2E Tests

End-to-end tests for Chive using Playwright.

## Overview

Browser-based tests that validate user workflows from the frontend through the API layer.

## Directory Structure

```
e2e/
├── fixtures/
│   ├── assets/
│   │   └── test-document.pdf
│   ├── page-objects.ts
│   └── test-data.ts
├── governance/
│   ├── contribution-type-approval.spec.ts
│   ├── contribution-type-proposal.spec.ts
│   ├── contribution-type-voting.spec.ts
│   ├── facet-proposal.spec.ts
│   ├── organization-proposal.spec.ts
│   └── reconciliation-proposal.spec.ts
├── search/
│   └── author-filter.spec.ts
├── submission/
│   ├── author-management.spec.ts
│   ├── contribution-selection.spec.ts
│   ├── external-author.spec.ts
│   ├── paper-centric-submission.spec.ts
│   └── traditional-submission.spec.ts
├── eprint/
│   └── author-display.spec.ts
├── *.spec.ts (root-level specs)
├── auth.setup.ts
├── global.setup.ts
└── global.teardown.ts
```

## Test Files

### Core Pages

| File                 | Description                               |
| -------------------- | ----------------------------------------- |
| `home.spec.ts`       | Home page, hero section, CTAs             |
| `navigation.spec.ts` | Header, footer, navigation links          |
| `browse.spec.ts`     | Eprint browsing and sorting               |
| `search.spec.ts`     | Search functionality, filters, pagination |
| `eprints.spec.ts`    | Eprint detail pages                       |
| `authors.spec.ts`    | Author profile pages                      |
| `fields.spec.ts`     | Field hierarchy navigation                |
| `tags.spec.ts`       | Tag browsing and trending                 |

### Authentication & User

| File                         | Description               |
| ---------------------------- | ------------------------- |
| `auth.spec.ts`               | OAuth login and logout    |
| `dashboard.spec.ts`          | User dashboard            |
| `account-linking.spec.ts`    | External account linking  |
| `alpha-signup.spec.ts`       | Alpha program signup flow |
| `notifications.spec.ts`      | Notification system       |
| `discovery-settings.spec.ts` | Discovery preferences     |

### Submissions

| File                                          | Description              |
| --------------------------------------------- | ------------------------ |
| `submit.spec.ts`                              | Eprint submission wizard |
| `submission/author-management.spec.ts`        | Author list management   |
| `submission/contribution-selection.spec.ts`   | CRediT role selection    |
| `submission/external-author.spec.ts`          | External author handling |
| `submission/paper-centric-submission.spec.ts` | Paper-centric workflow   |
| `submission/traditional-submission.spec.ts`   | Traditional workflow     |

### Governance

| File                   | Description                 |
| ---------------------- | --------------------------- |
| `governance.spec.ts`   | General governance features |
| `governance/*.spec.ts` | Specific proposal types     |

### Features

| File                           | Description                    |
| ------------------------------ | ------------------------------ |
| `for-you-feed.spec.ts`         | Personalized feed              |
| `related-papers.spec.ts`       | Related papers recommendations |
| `enrichment-backlinks.spec.ts` | Backlink enrichments           |
| `pdf-annotations.spec.ts`      | PDF annotation features        |
| `share-to-bluesky.spec.ts`     | Bluesky sharing                |

### Quality

| File                     | Description           |
| ------------------------ | --------------------- |
| `accessibility.spec.ts`  | WCAG compliance tests |
| `error-handling.spec.ts` | Error state handling  |
| `mobile.spec.ts`         | Mobile responsiveness |

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e -- navigation.spec.ts

# Run in headed mode
pnpm test:e2e -- --headed

# Run with debug
pnpm test:e2e:debug

# Run specific test suite
pnpm test:e2e -- tests/e2e/governance/
```

## Test Configuration

See `/playwright.config.ts` for configuration details.

Key settings:

- Base URL: `http://localhost:3000`
- Browsers: Chromium, Firefox, WebKit
- Retries: 2 in CI, 0 locally
- Screenshots: On failure
- Video: Retained on failure

## Fixtures

### Page Objects

Located in `fixtures/page-objects.ts`:

- `HeaderComponent` - Navigation header
- `AlphaLandingPage` - Alpha landing page elements
- `SearchPage` - Search functionality
- `EprintPage` - Eprint details
- `AuthorPage` - Author profiles
- `SignInPage` - Authentication
- `DashboardPage` - User dashboard

### Test Data

Located in `fixtures/test-data.ts`:

- `TEST_USER` - Mock user credentials
- `TEST_EPRINTS` - Sample eprint data
- `SEARCH_QUERIES` - Test search queries
- `ROUTES` - Application routes

### Test Assets

Located in `fixtures/assets/`:

- `test-document.pdf` - Sample PDF for upload tests

## Writing Tests

### Use Page Objects

```typescript
import { SearchPage } from './fixtures/page-objects';

test('performs search', async ({ page }) => {
  const searchPage = new SearchPage(page);
  await searchPage.goto();
  await searchPage.search('neural networks');
});
```

### Use Data-testid Selectors

Prefer `data-testid` attributes for stable selectors:

```typescript
const resultItem = page.locator('[data-testid="search-result"]');
```

### Handle Missing Data

Tests should handle cases where test data may not exist:

```typescript
const firstResult = page.locator('[data-testid="result"]').first();
if (await firstResult.isVisible()) {
  await firstResult.click();
}
```

## CI Integration

E2E tests run in CI with:

- Single worker (sequential execution)
- 2 retries on failure
- Trace collection on failure
- Screenshot capture on failure

See `.github/workflows/e2e.yml` for CI configuration.

## Related

- `tests/integration/` - Backend integration tests
- `tests/unit/` - Unit tests
- `/playwright.config.ts` - Playwright configuration
