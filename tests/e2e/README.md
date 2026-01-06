# E2E Tests

End-to-end tests for Chive using Playwright.

## Test Files

| File                    | Description                               |
| ----------------------- | ----------------------------------------- |
| `navigation.spec.ts`    | Header, footer, and navigation links      |
| `home.spec.ts`          | Home page, hero section, CTAs             |
| `search.spec.ts`        | Search functionality, filters, pagination |
| `browse.spec.ts`        | Preprint browsing and sorting             |
| `preprints.spec.ts`     | Preprint detail pages                     |
| `authors.spec.ts`       | Author profile pages                      |
| `fields.spec.ts`        | Field hierarchy navigation                |
| `tags.spec.ts`          | Tag browsing and trending                 |
| `auth.spec.ts`          | OAuth login and logout                    |
| `submit.spec.ts`        | Preprint submission wizard                |
| `dashboard.spec.ts`     | User dashboard                            |
| `governance.spec.ts`    | Governance proposals and voting           |
| `accessibility.spec.ts` | WCAG compliance tests                     |

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
- `HomePage` - Home page elements
- `SearchPage` - Search functionality
- `PreprintPage` - Preprint details
- `AuthorPage` - Author profiles
- `SignInPage` - Authentication
- `DashboardPage` - User dashboard

### Test Data

Located in `fixtures/test-data.ts`:

- `TEST_USER` - Mock user credentials
- `TEST_PREPRINTS` - Sample preprint data
- `SEARCH_QUERIES` - Test search queries
- `ROUTES` - Application routes

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
