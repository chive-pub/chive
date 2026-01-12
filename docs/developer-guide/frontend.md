# Frontend

This guide covers the Next.js 15 web application.

## Overview

The frontend is a React 19 application using:

- **Next.js 15** with App Router
- **TanStack Query v5** for data fetching
- **Radix UI** primitives via shadcn/ui
- **Tailwind CSS** for styling
- **Geist** font family
- **openapi-fetch** for type-safe API calls

## Project structure

```
web/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Home page
│   ├── authors/              # Author profile pages
│   ├── eprints/            # Eprint detail pages
│   ├── search/               # Search results page
│   ├── fields/               # Field taxonomy pages
│   └── governance/           # Governance and proposals
├── components/
│   ├── annotations/          # PDF text annotation components
│   ├── backlinks/            # Bluesky backlink display
│   ├── endorsements/         # Endorsement panel and badges
│   ├── enrichment/           # Citation enrichment display
│   ├── knowledge-graph/      # Field cards and relationships
│   ├── navigation/           # Header, nav, theme toggle
│   ├── eprints/            # Eprint cards, lists, PDF viewer
│   ├── providers/            # React context providers
│   ├── reviews/              # Review forms and threads
│   ├── search/               # Search input, facets, results
│   ├── share/                # Bluesky share components
│   ├── skeletons/            # Loading placeholders
│   ├── tags/                 # Tag chips, clouds, inputs
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── api/                  # API client and types
│   ├── atproto/              # ATProto record creation
│   ├── auth/                 # OAuth and session management
│   ├── bluesky/              # Bluesky API integration
│   ├── hooks/                # TanStack Query hooks
│   └── utils/                # Utility functions
└── styles/
    └── globals.css           # CSS variables and base styles
```

## Getting started

Install dependencies:

```bash
cd web
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open http://localhost:3000.

## Data fetching

Use TanStack Query hooks for all API calls:

```typescript
import { useEprint, useEprints } from '@/lib/hooks';

// Fetch a single eprint
const { data, isLoading, error } = useEprint(uri);

// Fetch paginated list
const { data, isLoading } = useEprints({ limit: 10 });
```

### Query configuration

The query client uses these defaults:

- **staleTime**: 30 seconds (data refetched after this period)
- **gcTime**: 5 minutes (cache garbage collection)
- **retry**: 1 attempt on failure
- **refetchOnWindowFocus**: true

### Query keys

Query keys follow a flat array pattern:

```typescript
// All eprints
['eprints'][
  // Eprint list with filters
  ('eprints', 'list', { limit: 10, field: 'cs.AI' })
][
  // Single eprint detail
  ('eprints', 'detail', 'at://did:plc:example/pub.chive.eprint.submission/123')
][
  // Search results
  ('search', { q: 'neural networks', limit: 20 })
];
```

## Components

### UI primitives

Located in `components/ui/`. These follow the shadcn/ui pattern built on Radix UI:

| Component      | Description                                    |
| -------------- | ---------------------------------------------- |
| `Button`       | Primary action with variant and size props     |
| `Card`         | Content container with header, content, footer |
| `Dialog`       | Modal dialogs with accessible focus management |
| `Input`        | Text input with consistent styling             |
| `Textarea`     | Multi-line text input                          |
| `Select`       | Dropdown selection with Radix primitives       |
| `Checkbox`     | Boolean input with indeterminate state         |
| `RadioGroup`   | Single selection from options                  |
| `Tabs`         | Tabbed content panels                          |
| `Tooltip`      | Hover information overlays                     |
| `Popover`      | Click-triggered floating content               |
| `DropdownMenu` | Context menu with keyboard navigation          |
| `ScrollArea`   | Styled scrollable container                    |
| `Skeleton`     | Loading placeholder animations                 |
| `Badge`        | Small labels and status indicators             |
| `Avatar`       | User profile images with fallback              |
| `Alert`        | Informational and error messages               |
| `Separator`    | Visual divider                                 |
| `Label`        | Form field labels                              |
| `Sonner`       | Toast notifications                            |

Example:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <h3>Title</h3>
  </CardHeader>
  <CardContent>
    <Button variant="outline" size="sm">
      Click me
    </Button>
  </CardContent>
</Card>;
```

### Eprint components

Located in `components/eprints/`:

| Component                 | Description                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `EprintCard`            | Summary card with title, authors, abstract. Supports `default`, `compact`, and `featured` variants |
| `EprintList`            | Paginated list of eprint cards                                                                   |
| `EprintMetadata`        | Full metadata display (DOI, dates, versions)                                                       |
| `EprintMetrics`         | View counts, downloads, engagement stats                                                           |
| `EprintVersions`        | Version history timeline                                                                           |
| `EprintSource`          | Source repository badge (arXiv, bioRxiv, etc.)                                                     |
| `AuthorChip`              | Clickable author name with avatar                                                                  |
| `AuthorHeader`            | Full author profile header                                                                         |
| `AuthorEprints`         | Paginated eprints by author                                                                      |
| `AuthorStats`             | Author metrics (h-index, citations, eprints)                                                     |
| `FieldBadge`              | Field taxonomy badge                                                                               |
| `OrcidBadge`              | ORCID identifier with verification                                                                 |
| `PDFViewer`               | Embedded PDF display                                                                               |
| `PDFAnnotationOverlay`    | Text selection and annotation layer                                                                |
| `PDFSelectionPopover`     | Context menu for PDF text selection                                                                |
| `PDFTextSelectionHandler` | Captures text selections in PDF                                                                    |

Example:

```tsx
import { EprintCard, EprintCardSkeleton } from '@/components/eprints/eprint-card';
import { usePrefetchEprint } from '@/lib/hooks';

function EprintList({ eprints, isLoading }) {
  const prefetch = usePrefetchEprint();

  if (isLoading) {
    return <EprintCardSkeleton />;
  }

  return eprints.map((eprint) => (
    <EprintCard key={eprint.uri} eprint={eprint} onPrefetch={prefetch} />
  ));
}
```

### Search components

Located in `components/search/`:

| Component               | Description                            |
| ----------------------- | -------------------------------------- |
| `SearchInput`           | Search field with autocomplete support |
| `SearchInputWithParams` | Search input synced with URL params    |
| `InlineSearch`          | Compact search for headers             |
| `SearchAutocomplete`    | Dropdown suggestions                   |
| `SearchHighlight`       | Highlights matching terms in results   |
| `SearchEmpty`           | Empty state for no results             |
| `SearchPagination`      | Page navigation controls               |
| `FacetChip`             | Active filter indicator                |

Example:

```tsx
import { SearchInputWithParams } from '@/components/search/search-input';

<SearchInputWithParams
  paramKey="q"
  searchRoute="/search"
  placeholder="Search eprints..."
  size="lg"
/>;
```

### Knowledge graph components

Located in `components/knowledge-graph/`:

| Component            | Description                    |
| -------------------- | ------------------------------ |
| `FieldCard`          | Field node display with stats  |
| `FieldExternalIds`   | Links to Wikidata, LCSH, etc.  |
| `FieldEprints`     | Eprints in a field           |
| `FieldRelationships` | Broader/narrower/related terms |

### Endorsement components

Located in `components/endorsements/`:

| Component                   | Description                             |
| --------------------------- | --------------------------------------- |
| `EndorsementPanel`          | Full endorsement display with filtering |
| `EndorsementBadge`          | Contribution type badge                 |
| `EndorsementBadgeGroup`     | Grouped badges by type                  |
| `EndorsementSummaryBadge`   | Total count badge                       |
| `EndorsementList`           | List of endorsements                    |
| `EndorsementSummaryCompact` | Compact summary for cards               |
| `EndorsementIndicator`      | Minimal count indicator                 |

Example:

```tsx
import { EndorsementPanel } from '@/components/endorsements/endorsement-panel';

<EndorsementPanel
  eprintUri={eprint.uri}
  onEndorse={() => setShowEndorseDialog(true)}
  currentUserDid={user?.did}
/>;
```

### Review components

Located in `components/reviews/`:

| Component                | Description                             |
| ------------------------ | --------------------------------------- |
| `ReviewForm`             | Create/edit review with character count |
| `InlineReplyForm`        | Compact reply form                      |
| `ReviewList`             | Paginated reviews                       |
| `ReviewThread`           | Threaded discussion display             |
| `ReviewCard`             | Single review with actions              |
| `AnnotationBodyRenderer` | Renders annotation content              |
| `TargetSpanPreview`      | Shows selected text being annotated     |
| `ParentReviewPreview`    | Shows parent review when replying       |

Example:

```tsx
import { ReviewForm } from '@/components/reviews/review-form';

<ReviewForm
  eprintUri={eprint.uri}
  onSubmit={async (data) => {
    await createReview.mutateAsync(data);
  }}
  onCancel={() => setShowForm(false)}
  isLoading={createReview.isPending}
/>;
```

### Tag components

Located in `components/tags/`:

| Component  | Description                    |
| ---------- | ------------------------------ |
| `TagChip`  | Clickable tag display          |
| `TagCloud` | Tag visualization by frequency |
| `TagInput` | Autocomplete tag entry         |
| `TagList`  | Horizontal tag list            |

### Adding new components

1. Check if shadcn/ui has the component: https://ui.shadcn.com
2. If yes, copy the component code to `components/ui/`
3. If no, create a new component following the CVA pattern

CVA (class-variance-authority) example:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('base-classes', {
  variants: {
    variant: {
      default: 'bg-primary text-white',
      outline: 'border border-input',
    },
    size: {
      default: 'h-9 px-4',
      sm: 'h-8 px-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});
```

## Theming

The app uses next-themes for dark mode:

- System preference detection
- Manual toggle (light/dark/system)
- No flash on page load

CSS variables in `styles/globals.css` define colors:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## Hooks reference

All TanStack Query hooks are organized by domain and exported from `lib/hooks/index.ts`.

### Eprint hooks

| Hook                        | Description                           |
| --------------------------- | ------------------------------------- |
| `useEprint(uri)`          | Fetch single eprint by AT-URI       |
| `useEprints(params)`      | Paginated eprint list               |
| `useEprintsByAuthor(did)` | Eprints by author DID               |
| `usePrefetchEprint()`     | Returns function to prefetch on hover |

```tsx
import { useEprint, eprintKeys } from '@/lib/hooks';

const { data, isLoading, error } = useEprint(
  'at://did:plc:abc/pub.chive.eprint.submission/123'
);

// Cache invalidation
queryClient.invalidateQueries({ queryKey: eprintKeys.all });
```

### Search hooks

| Hook                              | Description                      |
| --------------------------------- | -------------------------------- |
| `useSearch(query)`                | Full-text search with pagination |
| `useInstantSearch(query)`         | Debounced instant search         |
| `useFacetedSearch(query, facets)` | Search with PMEST facet filters  |
| `useFacetCounts(query)`           | Facet value counts               |
| `useLiveFacetedSearch()`          | Combined search state and facets |

Facet utilities:

```tsx
import {
  addFacetValue,
  removeFacetValue,
  toggleFacetValue,
  clearDimensionFilters,
  countTotalFilters,
  isFacetSelected,
} from '@/lib/hooks';

const newFacets = addFacetValue(currentFacets, 'fields', 'cs.AI');
```

### Discovery hooks

| Hook                           | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `useForYouFeed()`              | Personalized recommendations (infinite query)  |
| `useSimilarPapers(uri)`        | Related papers by similarity                   |
| `useCitations(uri)`            | Citation network (citing/cited-by)             |
| `useEnrichment(uri)`           | External metadata (Semantic Scholar, OpenAlex) |
| `useRecordInteraction()`       | Mutation to log user interactions              |
| `usePrefetchSimilarPapers()`   | Prefetch similar papers on hover               |
| `useDiscoverySettings()`       | User discovery preferences                     |
| `useUpdateDiscoverySettings()` | Mutation to update preferences                 |

```tsx
import { useForYouFeed, useRecordInteraction } from '@/lib/hooks';

const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useForYouFeed({
  limit: 10,
});

const allRecommendations = data?.pages.flatMap((p) => p.recommendations) ?? [];

const { mutate: recordInteraction } = useRecordInteraction();
recordInteraction({
  eprintUri,
  type: 'dismiss',
  recommendationId: 'rec-123',
});
```

### Author hooks

| Hook                    | Description                   |
| ----------------------- | ----------------------------- |
| `useAuthor(did)`        | Author profile by DID         |
| `useAuthorProfile(did)` | Extended profile with metrics |
| `useAuthorMetrics(did)` | Author statistics             |
| `usePrefetchAuthor()`   | Prefetch author on hover      |

Utilities:

```tsx
import { hasOrcid, formatOrcidUrl } from '@/lib/hooks';

if (hasOrcid(author)) {
  console.log(formatOrcidUrl(author.orcid)); // https://orcid.org/0000-0002-...
}
```

### Field hooks

| Hook                    | Description                       |
| ----------------------- | --------------------------------- |
| `useField(id)`          | Single field by ID                |
| `useFields()`           | All fields (for taxonomy display) |
| `useFieldChildren(id)`  | Narrower terms                    |
| `useFieldEprints(id)` | Eprints in field                |
| `usePrefetchField()`    | Prefetch field on hover           |

### Review hooks

| Hook                            | Description               |
| ------------------------------- | ------------------------- |
| `useReviews(eprintUri)`       | Reviews for a eprint    |
| `useInlineReviews(eprintUri)` | Inline annotations only   |
| `useReviewThread(reviewUri)`    | Threaded replies          |
| `useCreateReview()`             | Create review mutation    |
| `useDeleteReview()`             | Delete review mutation    |
| `usePrefetchReviews()`          | Prefetch reviews on hover |

```tsx
import { useReviews, useCreateReview } from '@/lib/hooks';

const { data: reviews, isLoading } = useReviews(eprintUri);
const createReview = useCreateReview();

await createReview.mutateAsync({
  content: 'Great methodology!',
  eprintUri,
  motivation: 'commenting',
});
```

### Endorsement hooks

| Hook                                   | Description                    |
| -------------------------------------- | ------------------------------ |
| `useEndorsements(eprintUri)`         | All endorsements for eprint  |
| `useEndorsementSummary(eprintUri)`   | Counts by contribution type    |
| `useUserEndorsement(eprintUri, did)` | Check if user has endorsed     |
| `useCreateEndorsement()`               | Create endorsement mutation    |
| `useUpdateEndorsement()`               | Update endorsement mutation    |
| `useDeleteEndorsement()`               | Delete endorsement mutation    |
| `usePrefetchEndorsements()`            | Prefetch endorsements on hover |

Constants:

```tsx
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  CONTRIBUTION_TYPE_DESCRIPTIONS,
  CONTRIBUTION_TYPE_CATEGORIES,
} from '@/lib/hooks/use-endorsement';

// CONTRIBUTION_TYPES: ['methodological', 'analytical', 'theoretical', ...]
// CONTRIBUTION_TYPE_CATEGORIES: { 'Core Research': [...], 'Technical': [...] }
```

### Tag hooks

| Hook                           | Description              |
| ------------------------------ | ------------------------ |
| `useEprintTags(eprintUri)` | Tags on a eprint       |
| `useTagSuggestions(query)`     | Autocomplete suggestions |
| `useTrendingTags()`            | Popular tags             |
| `useTagSearch(query)`          | Search all tags          |
| `useTagDetail(tagId)`          | Single tag with stats    |
| `useCreateTag()`               | Add tag mutation         |
| `useDeleteTag()`               | Remove tag mutation      |
| `usePrefetchTags()`            | Prefetch tags on hover   |

### Claiming hooks

| Hook                                   | Description                     |
| -------------------------------------- | ------------------------------- |
| `useUserClaims()`                      | Current user's claims           |
| `useClaim(claimId)`                    | Single claim details            |
| `useClaimableEprints(did)`           | Eprints available to claim    |
| `usePendingClaims()`                   | Claims awaiting approval        |
| `useStartClaim()`                      | Start claim mutation            |
| `useCollectEvidence()`                 | Gather verification evidence    |
| `useCompleteClaim()`                   | Submit claim for review         |
| `useApproveClaim()`                    | Approve claim (trusted editors) |
| `useRejectClaim()`                     | Reject claim (trusted editors)  |
| `usePaperSuggestions(profileMetadata)` | Suggested papers to claim       |

### Activity hooks

| Hook                       | Description                         |
| -------------------------- | ----------------------------------- |
| `useActivityFeed(options)` | User's activity feed                |
| `useLogActivity()`         | Log activity mutation               |
| `useMarkActivityFailed()`  | Mark activity as failed             |
| `useActivityLogging()`     | Combined activity logging utilities |

```tsx
import { useLogActivity, COLLECTIONS, generateRkey } from '@/lib/hooks';

const { mutate: logActivity } = useLogActivity();
logActivity({
  category: 'read',
  action: 'view',
  targetUri: eprintUri,
  collection: COLLECTIONS.PREPRINT,
});
```

### Profile autocomplete hooks

| Hook                                | Description                  |
| ----------------------------------- | ---------------------------- |
| `useOrcidAutocomplete(query)`       | ORCID ID suggestions         |
| `useAffiliationAutocomplete(query)` | Institution suggestions      |
| `useKeywordAutocomplete(query)`     | Research keyword suggestions |
| `useAuthorIdDiscovery(orcid)`       | Find matching author IDs     |

### Other hooks

| Hook                             | Description                        |
| -------------------------------- | ---------------------------------- |
| `useTrending()`                  | Trending eprints                 |
| `useBacklinks(eprintUri)`      | Bluesky posts referencing eprint |
| `useBacklinkCounts(eprintUri)` | Backlink counts by source          |
| `useShareToBluesky()`            | Share mutation for Bluesky         |
| `useMentionAutocomplete(query)`  | @mention suggestions               |
| `useGovernance*`                 | Governance proposal hooks          |
| `useIntegrations()`              | External service integrations      |

## Authentication

The frontend uses AT Protocol OAuth for authentication.

### OAuth flow

```
User clicks "Sign in"
         │
         ▼
Enter handle (e.g., user.bsky.social)
         │
         ▼
Redirect to PDS authorization endpoint
         │
         ▼
User approves access to Chive AppView
         │
         ▼
Redirect back with authorization code
         │
         ▼
Exchange code for access token
         │
         ▼
Store session in secure cookie
```

### Auth utilities

Located in `lib/auth/`:

| Module            | Description                |
| ----------------- | -------------------------- |
| `oauth-client.ts` | ATProto OAuth client setup |
| `session.ts`      | Session management         |
| `middleware.ts`   | Route protection           |

```tsx
import { getCurrentAgent, isAuthenticated } from '@/lib/auth/oauth-client';

const agent = getCurrentAgent();
if (agent) {
  // User is authenticated, can write to their PDS
  await agent.com.atproto.repo.createRecord({
    repo: agent.session.did,
    collection: 'pub.chive.review.comment',
    record: {
      /* ... */
    },
  });
}
```

### Writing to PDS

User content (reviews, endorsements, tags) is written directly to the user's PDS:

```tsx
import { createEndorsementRecord } from '@/lib/atproto/record-creator';
import { getCurrentAgent } from '@/lib/auth/oauth-client';

const agent = getCurrentAgent();
if (!agent) throw new Error('Not authenticated');

await createEndorsementRecord(agent, {
  eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
  contributions: ['methodological', 'empirical'],
  comment: 'Excellent methodology!',
});
```

## Page routes

| Route                      | Description                                   |
| -------------------------- | --------------------------------------------- |
| `/`                        | Home page with trending and recent eprints  |
| `/search`                  | Search results with faceted filtering         |
| `/eprints/[uri]`         | Eprint detail with reviews and endorsements |
| `/authors/[did]`           | Author profile with their eprints           |
| `/fields`                  | Field taxonomy browser                        |
| `/fields/[id]`             | Field detail with eprints                   |
| `/governance`              | Governance proposals list                     |
| `/governance/[proposalId]` | Proposal detail with voting                   |
| `/claims`                  | User's authorship claims                      |
| `/settings`                | User settings and preferences                 |

## Testing

### Unit tests

Run with Vitest:

```bash
pnpm test           # Run once
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage report
```

Test files are co-located with components:

```
components/ui/button.tsx
components/ui/button.test.tsx
```

### Component tests

Playwright Component Testing for visual/interaction tests:

```bash
pnpm test:ct
```

Test files use `.spec.tsx` extension in `tests/component/`.

## Storybook

View and develop components in isolation:

```bash
pnpm storybook
```

Opens at http://localhost:6006.

Story files are co-located:

```
components/ui/button.tsx
components/ui/button.stories.tsx
```

## API client

The API client uses openapi-fetch with generated types:

```typescript
import { api } from '@/lib/api/client';

// Type-safe API call
const { data, error } = await api.GET('/xrpc/pub.chive.eprint.getSubmission', {
  params: { query: { uri } },
});
```

### Regenerating types

When the backend API changes:

```bash
pnpm openapi:generate
```

This fetches `/openapi.json` from the backend and generates `lib/api/schema.d.ts`.

## Server vs client components

**Server Components** (default):

- Data fetching at build/request time
- No client-side JavaScript
- Use for static content, layouts

**Client Components** (`'use client'`):

- Interactive UI (buttons, forms, toggles)
- Hooks (useState, useEffect)
- Browser APIs

Example:

```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetchData(); // Runs on server
  return <div>{data.title}</div>;
}

// Client Component
('use client');

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## Scripts

| Script                  | Description              |
| ----------------------- | ------------------------ |
| `pnpm dev`              | Start development server |
| `pnpm build`            | Production build         |
| `pnpm start`            | Start production server  |
| `pnpm lint`             | Run ESLint               |
| `pnpm test`             | Run unit tests           |
| `pnpm test:ct`          | Run component tests      |
| `pnpm storybook`        | Start Storybook          |
| `pnpm openapi:generate` | Regenerate API types     |

## Related documentation

- [ATProto Specification](https://atproto.com/specs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query)
- [shadcn/ui](https://ui.shadcn.com)
