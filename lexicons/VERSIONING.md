# Lexicon Versioning Strategy

This document defines schema evolution and versioning procedures for Chive lexicons.

## Versioning Mechanism

Each lexicon JSON file carries a top-level `revision` integer (ATProto-standard field from `@atproto/lexicon`). This is a monotonic counter that increments whenever the schema changes.

Record-type lexicons also carry an optional `schemaRevision` field in their record definition. Clients set this when creating records so the indexer knows which migration to apply.

### Lexicon-Level Versioning

```json
{
  "lexicon": 1,
  "id": "pub.chive.eprint.submission",
  "revision": 2,
  "defs": { ... }
}
```

- `lexicon: 1` is the ATProto Lexicon language format version (always 1)
- `revision` is the schema content version (monotonic integer)
- All lexicons start at revision 1

### Record-Level Versioning

Record types include an optional `schemaRevision` field:

```json
{
  "schemaRevision": {
    "type": "integer",
    "minimum": 1,
    "description": "Schema revision this record was created with. Absent means revision 1."
  }
}
```

The indexer uses this to apply migrations at index time. Records without `schemaRevision` are treated as revision 1.

## Version Tracking

- **`lexicons/manifest.json`**: Central registry mapping each lexicon to its current revision, category, and the project version it last changed in.
- **This file**: Per-lexicon changelog below.
- **`src/services/migration/`**: Migration service with numbered migration files.

## Backward Compatibility Requirements

**Allowed (backward-compatible, revision bump only)**:

- Adding optional fields
- Adding new enum values to `knownValues` (if not exhaustive)
- Increasing `maxLength`, `maxSize`, or array `maxLength`
- Making required fields optional
- Adding new record types

**Breaking (requires new NSID)**:

- Removing required fields
- Renaming fields
- Making optional fields required
- Decreasing size/length limits
- Changing field types
- Removing enum values

### Field Removal on Record Types

Removing an optional field from a record-type lexicon is backward-compatible in ATProto (validators ignore unknown fields, old records remain valid). However, the indexer must handle both old records (with the field) and new records (without it) via the migration service.

## Migration Service

Located at `src/services/migration/`:

- `record-migrator.ts`: Core migration registry and runner
- `migrations/0001-*.ts`: Individual migration files (numbered sequentially)

Migrations run at index time in the firehose event processor, before record transformation. They are applied in sequence: revision 1 -> 2 -> 3 -> ... -> current.

```typescript
import { migrateRecord, needsMigration } from '../migration/index.js';

// In the indexing pipeline:
const migrated = needsMigration(collection, record) ? migrateRecord(collection, record) : record;
```

## Deprecation Process

### Step 1: Mark as Deprecated

Add deprecation notice to schema description:

```json
{
  "description": "DEPRECATED: Use pub.chive.eprint.submission#v2. Will be removed after 2026-06-01."
}
```

### Step 2: Deprecation Period

**Minimum**: 6 months from announcement. **Recommended**: 12 months for widely-used schemas.

During deprecation:

- Schema remains valid
- AppView continues indexing records
- API endpoints return deprecation headers

### Step 3: Migration Guide

Publish migration guide with field mapping, code examples, and automated migration scripts.

### Step 4: Removal

After deprecation period:

- Stop indexing deprecated records
- Remove from code generation
- Archive schema in `lexicons/archived/`

## Changelog

### pub.chive.defs

| Revision | Date       | Project Version | Change                                                                        |
| -------- | ---------- | --------------- | ----------------------------------------------------------------------------- |
| 1        | 2026-02-06 | 0.1.0           | Initial release with documentFormat, publicationStatus, supplementaryCategory |
| 2        | 2026-03-11 | 0.4.0           | Add canonical `affiliation` type with recursive `children` tree structure     |

### pub.chive.eprint.submission

| Revision | Date       | Project Version | Change                                                                                                                       |
| -------- | ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1        | 2025-11-29 | 0.1.0           | Initial release                                                                                                              |
| 2        | 2026-03-11 | 0.4.0           | Convert abstract to rich text array, add titleRich for LaTeX titles, add license URI from slug mapping                       |
| 3        | 2026-03-11 | 0.4.0           | Referenced authorContribution#affiliation changed: `department` replaced with `children` tree. Added `schemaRevision` field. |

### pub.chive.eprint.authorContribution

| Revision | Date       | Project Version | Change                                                                                                                |
| -------- | ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1        | 2026-01-12 | 0.1.0           | Initial release with local affiliation def (name, institutionUri, rorId, department)                                  |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; use `pub.chive.defs#affiliation` with recursive `children` instead of flat `department` |

### pub.chive.actor.profile

| Revision | Date       | Project Version | Change                                                                                                                  |
| -------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1        | 2025-11-29 | 0.1.0           | Initial release                                                                                                         |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; use `pub.chive.defs#affiliation` with recursive `children`. Added `schemaRevision` field. |

### pub.chive.metrics.getTrending

| Revision | Date       | Project Version | Change                                                                                |
| -------- | ---------- | --------------- | ------------------------------------------------------------------------------------- |
| 1        | 2026-01-21 | 0.1.0           | Initial release                                                                       |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; authorRef affiliations use `pub.chive.defs#affiliation` |

### pub.chive.graph.browseFaceted

| Revision | Date       | Project Version | Change                                                                                   |
| -------- | ---------- | --------------- | ---------------------------------------------------------------------------------------- |
| 1        | 2026-01-21 | 0.1.0           | Initial release                                                                          |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliationRef def; authorRef affiliations use `pub.chive.defs#affiliation` |

### pub.chive.admin.listAlphaApplications

| Revision | Date       | Project Version | Change                                                                                                                     |
| -------- | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | 2026-03-04 | 0.2.0           | Initial release                                                                                                            |
| 2        | 2026-03-11 | 0.4.0           | Fix affiliations/researchKeywords items from string to object refs matching actual data. Use `pub.chive.defs#affiliation`. |

### pub.chive.alpha.apply

| Revision | Date       | Project Version | Change                                                         |
| -------- | ---------- | --------------- | -------------------------------------------------------------- |
| 1        | 2026-01-21 | 0.1.0           | Initial release                                                |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; use `pub.chive.defs#affiliation` |

### pub.chive.actor.getMyProfile

| Revision | Date       | Project Version | Change                                                         |
| -------- | ---------- | --------------- | -------------------------------------------------------------- |
| 1        | 2026-01-21 | 0.1.0           | Initial release                                                |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; use `pub.chive.defs#affiliation` |

### pub.chive.author.getProfile

| Revision | Date       | Project Version | Change                                                         |
| -------- | ---------- | --------------- | -------------------------------------------------------------- |
| 1        | 2026-01-21 | 0.1.0           | Initial release                                                |
| 2        | 2026-03-11 | 0.4.0           | Remove local affiliation def; use `pub.chive.defs#affiliation` |

### Migrations

| ID   | Lexicons   | From | To  | Description                                                                          |
| ---- | ---------- | ---- | --- | ------------------------------------------------------------------------------------ |
| 0001 | submission | 1    | 2   | Convert abstract to rich text array, add titleRich for LaTeX titles, add license URI |
| 0002 | submission | 2    | 3   | Replace flat `department` on affiliations with recursive `children` tree             |
| 0002 | profile    | 1    | 2   | Replace flat `department` on affiliations with recursive `children` tree             |

---

## Related documents

- [ATProto Lexicon Specification](https://atproto.com/specs/lexicon)
- [Manifest](manifest.json) - machine-readable version registry
- [Migration service](../src/services/migration/) - record migration implementation
