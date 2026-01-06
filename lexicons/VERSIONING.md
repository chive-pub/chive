# Lexicon Versioning Strategy

This document defines schema evolution and versioning procedures for Chive lexicons.

## Versioning Principles

### Semantic Versioning

Lexicon schemas follow semantic versioning adapted for schema design:

- **Major version** (v1 → v2): Breaking changes requiring data migration
- **Minor version** (implicit in schema updates): Backward-compatible additions
- **Patch** (schema corrections): Non-breaking fixes

### Backward Compatibility Requirements

**Allowed (backward-compatible)**:

- Adding optional fields
- Adding new enum values to `knownValues` (if not exhaustive)
- Increasing `maxLength`, `maxSize`, or array `maxLength`
- Making required fields optional
- Adding new record types

**Breaking (requires new major version)**:

- Removing fields
- Renaming fields
- Making optional fields required
- Decreasing size/length limits
- Changing field types
- Removing enum values

## Version Notation

Lexicon schemas use NSID fragments for versioning:

```
pub.chive.preprint.submission      # v1 (implicit)
pub.chive.preprint.submission#v2   # v2 (explicit)
```

Version 1 has no fragment. Subsequent versions use `#v{number}`.

## Deprecation Process

### Step 1: Mark as Deprecated

Add deprecation notice to schema description:

```json
{
  "description": "DEPRECATED: Use pub.chive.preprint.submission#v2. This version will be removed after 2026-06-01.",
  ...
}
```

### Step 2: Deprecation Period

**Minimum**: 6 months from deprecation announcement
**Recommended**: 12 months for widely-used schemas

During deprecation:

- Schema remains valid
- AppView continues indexing records
- API endpoints return deprecation headers
- Documentation shows warning banners

### Step 3: Migration Guide

Publish migration guide including:

- Reason for deprecation
- Field mapping (old → new)
- Code examples
- Automated migration scripts (if possible)

### Step 4: Removal

After deprecation period:

- Stop indexing deprecated records
- Remove from code generation
- Archive schema in `lexicons/archived/`

## Migration Examples

### Adding Optional Field (Non-Breaking)

**v1** (pub.chive.preprint.submission):

```json
{
  "required": ["title", "abstract", "pdf"],
  "properties": {
    "title": { "type": "string" },
    "abstract": { "type": "string" },
    "pdf": { "type": "blob" }
  }
}
```

**v1 (updated)**: Add optional `doi` field

```json
{
  "required": ["title", "abstract", "pdf"],
  "properties": {
    "title": { "type": "string" },
    "abstract": { "type": "string" },
    "pdf": { "type": "blob" },
    "doi": { "type": "string" } // New optional field
  }
}
```

**Result**: No version increment needed. Backward-compatible.

### Renaming Field (Breaking)

**v1**: `coAuthors` field

```json
{
  "coAuthors": {
    "type": "array",
    "items": { "type": "string", "format": "did" }
  }
}
```

**v2** (pub.chive.preprint.submission#v2): Rename to `additionalAuthors`

```json
{
  "additionalAuthors": {
    "type": "array",
    "items": { "type": "string", "format": "did" }
  }
}
```

**Migration**:

```typescript
// Automated migration script
function migrateV1toV2(v1Record) {
  return {
    ...v1Record,
    additionalAuthors: v1Record.coAuthors,
  };
  // Remove coAuthors from new record
}
```

## Compatibility Testing

All schema changes must pass compatibility tests:

**Test Suite**: `tests/compliance/lexicon-compatibility.test.ts`

Validates:

- Valid v1 records remain valid after schema update
- New schemas accept all previous valid inputs
- Breaking changes increment major version

## Changelog

Track all schema changes in this file:

### pub.chive.preprint.submission

- **2025-11-29**: v1 initial release
- **TBD**: v2 planned - consolidate `coAuthors` into `contributors` array with roles

### pub.chive.graph.facet

- **2025-11-29**: v1 initial release

### pub.chive.actor.profile

- **2025-11-29**: v1 initial release

---

## Related documents

- [ATProto Lexicon Specification](https://atproto.com/guides/lexicon)
