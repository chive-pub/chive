# Components Directory

This directory contains reusable React components for the Chive frontend, organized by domain and functionality.

## Directory Structure

### UI Primitives

| Directory | Description                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `ui/`     | Base UI components built on Radix UI primitives (Button, Card, Dialog, Input, Select, Tabs, Tooltip, etc.) |

### Domain Components

| Directory          | Description                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `alpha/`           | Alpha program UI (status badges, application forms)                                                           |
| `annotations/`     | PDF annotation and inline review components                                                                   |
| `auth/`            | Authentication components (LoginDialog, LoginForm, AuthGuard, UserMenu)                                       |
| `authors/`         | Author-related components                                                                                     |
| `backlinks/`       | Backlink display components                                                                                   |
| `discovery/`       | Recommendation and discovery UI (badges, onboarding)                                                          |
| `documents/`       | Document-related components                                                                                   |
| `endorsements/`    | Endorsement display and creation components                                                                   |
| `enrichment/`      | Content enrichment UI                                                                                         |
| `eprints/`         | Eprint display components (EprintCard, EprintList, EprintHeader, PDFViewer, AuthorChip, FieldBadge)           |
| `forms/`           | Form input components (FileDropzone, DOI/ORCID/Zenodo/PubMed autocompletes, conference/journal/funder inputs) |
| `governance/`      | Community governance UI (proposal cards, voting, editor management)                                           |
| `integrations/`    | External service badges (Zenodo, GitHub, Software Heritage)                                                   |
| `knowledge-graph/` | Knowledge graph visualization and field components (FieldCard, FieldHierarchy, NodeSearch)                    |
| `landing/`         | Landing page components (QuickActionCard)                                                                     |
| `layout/`          | Layout primitives (PageContainer)                                                                             |
| `navigation/`      | Navigation components (ThemeToggle, AuthButton)                                                               |
| `providers/`       | React context providers (ThemeProvider, QueryProvider)                                                        |
| `reviews/`         | Review display and creation components                                                                        |
| `search/`          | Search UI (SearchInput, FacetPanel, SearchResults, SearchHighlight, SearchPagination)                         |
| `settings/`        | User settings components (AuthorIdDiscovery, AffiliationAutocomplete)                                         |
| `share/`           | Social sharing components                                                                                     |
| `skeletons/`       | Loading skeleton components                                                                                   |
| `submit/`          | Eprint submission wizard components (SubmissionWizard, step components)                                       |
| `tags/`            | Tag components (TagChip, TagList, TagInput, TrendingTags)                                                     |

### Standalone Components

- **`conditional-header.tsx`** - Header that hides on certain routes
- **`skip-link.tsx`** - Accessibility skip link for keyboard navigation

## Usage Patterns

### Importing Components

Most directories export via barrel files (`index.ts`):

```tsx
// Import from domain barrel
import { EprintCard, EprintList, AuthorChip } from '@/components/eprints';
import { LoginDialog, AuthGuard } from '@/components/auth';
import { SearchInput, FacetPanel } from '@/components/search';
import { Button, Card, Dialog } from '@/components/ui';
```

### Component Conventions

- Components are written in TypeScript with explicit prop types
- Each component typically has a corresponding `.test.tsx` file
- Skeleton variants are provided for loading states (e.g., `EprintCardSkeleton`)
- Complex components may have multiple exports (e.g., `EprintHeader`, `EprintHeaderSkeleton`, `CompactEprintHeader`)

### Dynamic Imports

Some components require dynamic imports to avoid SSR issues:

```tsx
// PDF viewer with annotations (pdfjs-dist is client-only)
const AnnotatedPDFViewer = dynamic(
  () => import('@/components/eprints/pdf-viewer-annotated').then((mod) => mod.AnnotatedPDFViewer),
  { ssr: false, loading: () => <AnnotatedPDFViewerSkeleton /> }
);
```

## Dependencies

- **Radix UI** - Accessible primitives for ui/ components
- **Tailwind CSS** - Styling via utility classes
- **React Query** - Data fetching (consumed via `@/lib/hooks`)
- **Lucide React** - Icons
