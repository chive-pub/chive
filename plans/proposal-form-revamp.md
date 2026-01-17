# Proposal Form & Authority Search Revamp Plan

## Overview

Revamp the governance proposal form and authority search UI to align with the knowledge graph implementation from `notes/splendid-sniffing-acorn.md`.

---

## Issues Identified

### Proposal Form Issues

1. **Missing "Concept" category** - The concept system has 17 categories (institution-type, paper-type, methodology, etc.) but users cannot propose new concepts

2. **"Organization" should be "Institution"** - The actual implementation uses `institution-repository.ts` with ROR integration, not generic "organizations"

3. **Hardcoded organization types** - Lines 396-407 hardcode types like "university", "research-lab" etc. These should come from the Concept system (`institution-type` category)

4. **Confusing terminology**:
   - "Reconciliation" → Should be "External Link" or "Entity Mapping"
   - "Contribution Type" is very narrow (just CRediT roles)

### Authority Search Issues

1. **Mock implementation** - `authority-search.tsx` returns empty array, doesn't call actual API

2. **Single entity type** - Only searches Authority Records, not the full knowledge graph (Concepts, Institutions, Facets, Fields)

3. **No type filtering** - Backend supports `type` parameter but UI doesn't expose it

4. **Should be unified search** - Need a "Knowledge Graph Search" that searches across all entity types

---

## Implementation Plan

### Phase 1: Update Proposal Categories (Backend + Frontend)

#### 1.1 Update Backend Schema

**File**: `src/api/schemas/governance.ts`

```typescript
// Change from:
export const proposalCategorySchema = z.enum([
  'field',
  'contribution-type',
  'facet',
  'organization',
  'reconciliation',
]);

// To:
export const proposalCategorySchema = z.enum([
  'field', // Knowledge graph fields
  'concept', // NEW: Concepts (types, methodologies, statuses)
  'institution', // RENAMED from 'organization'
  'facet', // PMEST/FAST facet values
  'authority', // NEW: Authority records
  'external-link', // RENAMED from 'reconciliation'
]);
```

#### 1.2 Update Frontend Categories

**File**: `web/components/governance/proposal-form.tsx`

Update `CATEGORIES` constant (lines 213-244):

```typescript
const CATEGORIES = [
  {
    value: 'field' as const,
    label: 'Field',
    description: 'Research fields and disciplines in the knowledge graph',
    icon: FileText,
  },
  {
    value: 'concept' as const,
    label: 'Concept',
    description: 'Types, methodologies, statuses, and other controlled vocabulary',
    icon: Tag,
  },
  {
    value: 'institution' as const,
    label: 'Institution',
    description: 'Universities, research labs, and organizations',
    icon: Building2,
  },
  {
    value: 'facet' as const,
    label: 'Facet',
    description: 'PMEST/FAST classification facet values',
    icon: Layers,
  },
  {
    value: 'authority' as const,
    label: 'Authority Record',
    description: 'Controlled vocabulary terms with variants',
    icon: BookOpen,
  },
  {
    value: 'external-link' as const,
    label: 'External Link',
    description: 'Link Chive entities to Wikidata, ROR, ORCID, etc.',
    icon: Link2,
  },
];
```

#### 1.3 Update Category Labels Hook

**File**: `web/lib/hooks/use-governance.ts`

Update `CATEGORY_LABELS` (around line 1011):

```typescript
export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  field: 'Field',
  concept: 'Concept',
  institution: 'Institution',
  facet: 'Facet',
  authority: 'Authority Record',
  'external-link': 'External Link',
};
```

---

### Phase 2: Add Concept Proposal Support

#### 2.1 Add Concept Form Fields

**File**: `web/components/governance/proposal-form.tsx`

Add new constants for concept proposals:

```typescript
const CONCEPT_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Concept',
    description: 'Propose a new concept term',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Concept',
    description: 'Modify an existing concept',
    icon: Edit,
  },
  {
    value: 'delete' as const,
    label: 'Deprecate Concept',
    description: 'Mark a concept as deprecated',
    icon: Trash2,
  },
];

// Categories from the concept system
const CONCEPT_CATEGORIES = [
  {
    value: 'institution-type',
    label: 'Institution Type',
    description: 'University, Lab, Company, etc.',
  },
  {
    value: 'paper-type',
    label: 'Paper Type',
    description: 'Empirical Study, Survey, Tutorial, etc.',
  },
  {
    value: 'methodology',
    label: 'Methodology',
    description: 'Qualitative, Quantitative, Mixed Methods',
  },
  { value: 'document-format', label: 'Document Format', description: 'PDF, LaTeX, Jupyter, etc.' },
  {
    value: 'publication-status',
    label: 'Publication Status',
    description: 'Preprint, Published, etc.',
  },
  { value: 'access-type', label: 'Access Type', description: 'Open Access, Gold OA, etc.' },
  { value: 'platform-code', label: 'Code Platform', description: 'GitHub, GitLab, etc.' },
  { value: 'platform-data', label: 'Data Platform', description: 'Zenodo, Figshare, etc.' },
  {
    value: 'supplementary-type',
    label: 'Supplementary Type',
    description: 'Dataset, Code, Video, etc.',
  },
  {
    value: 'researcher-type',
    label: 'Researcher Type',
    description: 'Faculty, Postdoc, PhD Student',
  },
  { value: 'identifier-type', label: 'Identifier Type', description: 'DOI, arXiv ID, PMID, etc.' },
  { value: 'presentation-type', label: 'Presentation Type', description: 'Oral, Poster, Keynote' },
];
```

Add form fields for concept proposals:

```typescript
// Form values additions
conceptCategory?: ConceptCategory;  // Which category of concept
conceptSlug: string;                // URL-friendly identifier
conceptName: string;                // Display name
conceptDescription: string;         // Description
parentConceptUri?: string;          // For hierarchical concepts
wikidataId?: string;                // Wikidata mapping
```

#### 2.2 Add Concept Form Section

Add rendering for concept fields when `category === 'concept'`:

- Concept category dropdown (from CONCEPT_CATEGORIES)
- Slug input (auto-generated from name)
- Name input
- Description textarea
- Parent concept autocomplete (optional, for hierarchy)
- Wikidata ID input (optional)

---

### Phase 3: Rename Organization to Institution

#### 3.1 Update Proposal Types

**File**: `web/components/governance/proposal-form.tsx`

Rename `ORGANIZATION_PROPOSAL_TYPES` to `INSTITUTION_PROPOSAL_TYPES`:

```typescript
const INSTITUTION_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Institution',
    description: 'Propose a new institution',
    icon: Plus,
  },
  // ... etc
];
```

#### 3.2 Use Concept System for Institution Types

Remove hardcoded `ORGANIZATION_TYPES` constant. Instead, use `ConceptAutocomplete` with `category="institution-type"`:

```tsx
// Replace hardcoded dropdown with:
<ConceptAutocomplete
  category="institution-type"
  value={form.watch('institutionTypeUri')}
  onSelect={(concept) => form.setValue('institutionTypeUri', concept.uri)}
/>
```

#### 3.3 Update Form Field Names

Rename org-prefixed fields to institution-prefixed:

- `existingOrgId` → `existingInstitutionId`
- `orgName` → `institutionName`
- `orgType` → `institutionTypeUri` (now AT-URI, not enum)
- etc.

---

### Phase 4: Create Unified Knowledge Graph Search

#### 4.1 Create KnowledgeGraphSearch Component

**Create**: `web/components/knowledge-graph/knowledge-graph-search.tsx`

```tsx
interface KnowledgeGraphSearchProps {
  query: string;
  entityTypes?: ('field' | 'concept' | 'institution' | 'facet' | 'authority')[];
  onSelect: (result: KnowledgeGraphResult) => void;
  limit?: number;
}

// Searches across multiple entity types in parallel
// Displays results grouped by type
// Returns unified result format
```

Features:

- Multi-entity type search (parallel API calls)
- Grouped results by entity type
- Entity-specific icons and badges
- External ID links (Wikidata, ROR, etc.)
- Status indicators

#### 4.2 Update Authority Search Component

**File**: `web/components/annotations/authority-search.tsx`

- Replace mock with actual API call to `/xrpc/pub.chive.graph.searchAuthorities`
- Add `type` filter prop for person/organization/concept/place
- Add external ID display (Wikidata, LCSH, FAST, VIAF)

---

### Phase 5: Add Authority Proposal Support

#### 5.1 Add Authority Form Fields

```typescript
const AUTHORITY_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Authority',
    description: 'Propose a new controlled term',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Authority',
    description: 'Add variants or update scope note',
    icon: Edit,
  },
  {
    value: 'merge' as const,
    label: 'Merge Authorities',
    description: 'Combine duplicate authority records',
    icon: Merge,
  },
  {
    value: 'delete' as const,
    label: 'Deprecate Authority',
    description: 'Mark with USE INSTEAD reference',
    icon: Trash2,
  },
];
```

Form fields:

- Authority type (person, organization, concept, place)
- Authorized form (canonical name)
- Variant forms (array of alternatives)
- Scope note (description)
- External mappings (Wikidata, LCSH, FAST, VIAF)

---

## Files Summary

### Create (2 files)

| File                                                        | Description                   |
| ----------------------------------------------------------- | ----------------------------- |
| `web/components/knowledge-graph/knowledge-graph-search.tsx` | Unified multi-entity search   |
| `web/components/knowledge-graph/index.ts`                   | Export barrel (if not exists) |

### Modify (6 files)

| File                                              | Changes                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| `src/api/schemas/governance.ts`                   | Update proposalCategorySchema enum                     |
| `web/components/governance/proposal-form.tsx`     | Add concept/authority sections, rename org→institution |
| `web/lib/hooks/use-governance.ts`                 | Update CATEGORY_LABELS                                 |
| `web/components/annotations/authority-search.tsx` | Wire to actual API, add type filter                    |
| `web/lib/api/schema.d.ts`                         | Update ProposalCategory type                           |
| `web/lib/types/forms.ts`                          | Update form value types (if exists)                    |

---

## Migration Notes

### Database/Backend

- The `proposalCategorySchema` change is **additive** - old categories still work
- No data migration needed if we keep backward compatibility
- Consider: should we migrate existing 'organization' proposals to 'institution'?

### Frontend

- Update any code that hard-codes category values
- Update tests that use old category names

---

## Verification

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test:unit

# Manual testing:
# 1. Navigate to /governance/propose
# 2. Verify all 6 categories appear with correct labels
# 3. Select "Concept" → verify concept-specific fields appear
# 4. Select "Institution" → verify type dropdown uses ConceptAutocomplete
# 5. Test knowledge graph search component with various entity types
# 6. Verify authority search returns results from API
```
