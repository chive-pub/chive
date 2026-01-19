# App Directory

This directory contains the Next.js 15 App Router pages and layouts for the Chive frontend.

## Directory Structure

### Route Groups

- **`(alpha)/`** - Alpha program pages (apply, pending status)
- **`(browse)/`** - Browse/discovery interface
- **`(search)/`** - Search functionality

### Main Routes

| Directory      | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `about/`       | About page with information about Chive                                                          |
| `authors/`     | Author listing and profile pages (`/authors`, `/authors/[did]`)                                  |
| `coming-soon/` | Placeholder for upcoming features                                                                |
| `dashboard/`   | User dashboard with tabs for eprints, reviews, endorsements, claims, notifications, and settings |
| `eprints/`     | Eprint listing and detail pages (`/eprints`, `/eprints/[...uri]`)                                |
| `fields/`      | Knowledge graph field pages (`/fields`, `/fields/[id]`, `/fields/explore`)                       |
| `governance/`  | Community governance pages (proposals, moderation, admin)                                        |
| `graph/`       | Interactive knowledge graph visualization                                                        |
| `login/`       | Authentication page                                                                              |
| `oauth/`       | OAuth callback handlers and client metadata                                                      |
| `og/`          | Open Graph image generation route                                                                |
| `onboarding/`  | New user onboarding flow                                                                         |
| `submit/`      | Eprint submission wizard and claim flow                                                          |
| `tags/`        | Tag listing and detail pages (`/tags`, `/tags/[tag]`)                                            |
| `trending/`    | Trending eprints page                                                                            |

### Key Files

- **`layout.tsx`** - Root layout with providers, header, and global styles
- **`README.md`** - This file

## Conventions

- Each route directory contains:
  - `page.tsx` - Main page component
  - `layout.tsx` - Optional route-specific layout
  - `loading.tsx` - Loading state skeleton
  - `not-found.tsx` - 404 handling (where applicable)
  - `*-content.tsx` - Client components with data fetching logic

- Route groups `(name)` share layouts without affecting URL structure
- Dynamic routes use `[param]` for single segments and `[...param]` for catch-all

## Dependencies

The app uses:

- `@/components/*` - UI components
- `@/lib/hooks/*` - Data fetching hooks (React Query)
- `@/lib/auth/*` - Authentication context and utilities
