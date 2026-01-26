# Frontend Eprint Lifecycle Components

This guide covers the React components and hooks for eprint editing, versioning, and deletion.

## Architecture Overview

The eprint lifecycle features follow a two-step authorization pattern:

1. **Backend authorization**: The frontend calls an XRPC endpoint to validate permissions and compute version numbers
2. **PDS write**: The frontend uses the ATProto agent to write to the user's (or paper's) PDS

This design keeps authorization logic on the backend while maintaining ATProto's principle that users control their own data.

## React Query Hooks

All lifecycle operations use TanStack Query mutations located in `web/lib/hooks/use-eprint-mutations.ts`.

### useUpdateEprint

Authorizes an eprint update and returns the new version info.

```typescript
import { useUpdateEprint, formatVersion } from '@/lib/hooks/use-eprint-mutations';

function EditEprintForm({ eprint }) {
  const { mutateAsync: updateEprint, isPending, error } = useUpdateEprint();
  const agent = useAgent();

  const handleSubmit = async (values) => {
    // Step 1: Get authorization and new version from backend
    const authResult = await updateEprint({
      uri: eprint.uri,
      versionBump: values.versionBump,
      title: values.title,
      keywords: values.keywords,
      changelog: values.changelog,
    });

    // Step 2: Update record in PDS with optimistic concurrency control
    await agent.com.atproto.repo.putRecord({
      repo: eprint.repo,
      collection: eprint.collection,
      rkey: eprint.rkey,
      record: { ...currentRecord, version: authResult.version },
      swapRecord: authResult.expectedCid,
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### useDeleteEprint

Authorizes an eprint deletion.

```typescript
import { useDeleteEprint } from '@/lib/hooks/use-eprint-mutations';

function DeleteEprintButton({ eprint }) {
  const { mutateAsync: deleteEprint, isPending } = useDeleteEprint();
  const agent = useAgent();

  const handleDelete = async () => {
    // Step 1: Authorize deletion
    await deleteEprint({ uri: eprint.uri });

    // Step 2: Delete record from PDS
    await agent.com.atproto.repo.deleteRecord({
      repo: eprint.repo,
      collection: eprint.collection,
      rkey: eprint.rkey,
    });
  };

  return <button onClick={handleDelete} disabled={isPending}>Delete</button>;
}
```

### useEprintPermissions

Determines if the current user can modify an eprint.

```typescript
import { useEprintPermissions } from '@/lib/hooks/use-eprint-mutations';

function EprintActions({ eprint, userDid }) {
  const { canModify, requiresPaperAuth, reason } = useEprintPermissions(eprint, userDid);

  if (!canModify) {
    return <span title={reason}>Editing disabled</span>;
  }

  if (requiresPaperAuth) {
    return <PaperAuthGate eprint={eprint}><EditButton /></PaperAuthGate>;
  }

  return <EditButton />;
}
```

### useEprintChangelogs

Fetches paginated changelogs for an eprint.

```typescript
import { useEprintChangelogs } from '@/lib/hooks/use-eprint-mutations';

function VersionHistory({ eprintUri }) {
  const { data, isLoading, error } = useEprintChangelogs(eprintUri, {
    limit: 20,
  });

  if (isLoading) return <VersionHistorySkeleton />;
  if (error) return <ChangelogError error={error} />;

  return (
    <ul>
      {data?.changelogs.map((changelog) => (
        <VersionEntry key={changelog.uri} changelog={changelog} />
      ))}
    </ul>
  );
}
```

### formatVersion

Formats a semantic version object as a display string.

```typescript
import { formatVersion } from '@/lib/hooks/use-eprint-mutations';

formatVersion({ major: 1, minor: 2, patch: 3 });
// Returns: "1.2.3"

formatVersion({ major: 2, minor: 0, patch: 0, prerelease: 'draft' });
// Returns: "2.0.0-draft"
```

## UI Components

### EprintEditDialog

Dialog for editing eprint metadata and creating new versions.

**Location:** `web/components/eprints/eprint-edit-dialog.tsx`

```typescript
import { EprintEditDialog } from '@/components/eprints/eprint-edit-dialog';

<EprintEditDialog
  eprint={{
    uri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
    rkey: '123',
    collection: 'pub.chive.eprint.submission',
    title: 'My Eprint',
    keywords: ['machine learning', 'nlp'],
    version: { major: 1, minor: 0, patch: 0 },
    repo: 'did:plc:abc',
  }}
  canEdit={true}
  onSuccess={() => refetch()}
>
  <Button variant="outline">Edit Eprint</Button>
</EprintEditDialog>
```

**Props:**

| Prop      | Type           | Description                      |
| --------- | -------------- | -------------------------------- |
| eprint    | EprintEditData | Current eprint data              |
| canEdit   | boolean        | Whether user has edit permission |
| onSuccess | () => void     | Callback after successful edit   |
| children  | ReactNode      | Trigger element (optional)       |

### DeleteEprintDialog

Confirmation dialog for eprint deletion.

**Location:** `web/components/eprints/delete-dialog.tsx`

```typescript
import { DeleteEprintDialog } from '@/components/eprints/delete-dialog';

<DeleteEprintDialog
  title={eprint.title}
  uri={eprint.uri}
  canDelete={canModify}
  isPending={isDeleting}
  onConfirm={handleDelete}
>
  <Button variant="destructive">Delete</Button>
</DeleteEprintDialog>
```

**Props:**

| Prop      | Type       | Description                         |
| --------- | ---------- | ----------------------------------- |
| title     | string     | Eprint title for confirmation       |
| uri       | string     | AT-URI of eprint                    |
| canDelete | boolean    | Whether deletion is allowed         |
| isPending | boolean    | Whether delete operation is running |
| onConfirm | () => void | Callback when deletion is confirmed |
| children  | ReactNode  | Trigger element (optional)          |

### VersionSelector

Radio group for selecting version bump type.

**Location:** `web/components/eprints/version-selector.tsx`

```typescript
import { VersionSelector } from '@/components/eprints/version-selector';

const [versionBump, setVersionBump] = useState<VersionBumpType>('patch');

<VersionSelector
  value={versionBump}
  onChange={setVersionBump}
  currentVersion="1.2.3"
  disabled={false}
/>
```

**Props:**

| Prop           | Type                             | Description                  |
| -------------- | -------------------------------- | ---------------------------- |
| value          | 'major' \| 'minor' \| 'patch'    | Selected version bump type   |
| onChange       | (value: VersionBumpType) => void | Selection change handler     |
| currentVersion | string                           | Current version for display  |
| disabled       | boolean                          | Whether selector is disabled |

### ChangelogForm

Form for creating structured changelogs.

**Location:** `web/components/eprints/changelog-form.tsx`

```typescript
import { ChangelogForm, type ChangelogFormData } from '@/components/eprints/changelog-form';

const [changelog, setChangelog] = useState<ChangelogFormData>({
  summary: '',
  sections: [],
  reviewerResponse: undefined,
});

<ChangelogForm
  value={changelog}
  onChange={setChangelog}
  showReviewFields={isRespondingToReview}
  disabled={isSubmitting}
/>
```

**Props:**

| Prop             | Type                               | Description                  |
| ---------------- | ---------------------------------- | ---------------------------- |
| value            | ChangelogFormData                  | Current changelog state      |
| onChange         | (value: ChangelogFormData) => void | State change handler         |
| showReviewFields | boolean                            | Show review reference fields |
| disabled         | boolean                            | Disable all inputs           |
| className        | string                             | Additional CSS classes       |

### VersionHistory

Timeline display of version history with expandable changelogs.

**Location:** `web/components/eprints/version-history.tsx`

```typescript
import { VersionHistory } from '@/components/eprints/version-history';

<VersionHistory eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123" />
```

**Props:**

| Prop      | Type   | Description            |
| --------- | ------ | ---------------------- |
| eprintUri | string | AT-URI of the eprint   |
| className | string | Additional CSS classes |

### PaperAuthGate

Wrapper that requires paper account authentication for paper-centric eprints.

**Location:** `web/components/eprints/paper-auth-gate.tsx`

```typescript
import { PaperAuthGate } from '@/components/eprints/paper-auth-gate';

<PaperAuthGate
  eprint={eprint}
  onAuthenticated={() => console.log('Paper auth successful')}
>
  <EditEprintDialog eprint={eprint} canEdit={true} />
</PaperAuthGate>
```

**Props:**

| Prop            | Type       | Description                          |
| --------------- | ---------- | ------------------------------------ |
| eprint          | EprintData | Eprint with optional paperDid        |
| children        | ReactNode  | Content to render when authenticated |
| onAuthenticated | () => void | Callback when paper auth succeeds    |

**Behavior:**

- If `eprint.paperDid` is undefined, children render directly
- If `eprint.paperDid` is set, shows `PaperAuthPrompt` until authenticated

### PaperAuthPrompt

UI for initiating paper account authentication.

**Location:** `web/components/eprints/paper-auth-prompt.tsx`

```typescript
import { PaperAuthPrompt } from '@/components/eprints/paper-auth-prompt';

<PaperAuthPrompt
  paperDid="did:plc:paper123"
  onSuccess={() => setAuthenticated(true)}
  onError={(err) => toast.error(err.message)}
/>
```

**Props:**

| Prop      | Type                   | Description                         |
| --------- | ---------------------- | ----------------------------------- |
| paperDid  | string                 | DID of paper account                |
| onSuccess | () => void             | Callback on successful auth         |
| onError   | (error: Error) => void | Callback on auth failure (optional) |

## Data Types

### EprintEditData

Data required for the edit dialog.

```typescript
interface EprintEditData {
  uri: string; // AT-URI of the eprint
  rkey: string; // Record key
  collection: string; // Collection NSID
  title: string; // Current title
  keywords?: string[]; // Current keywords
  version?: SemanticVersion; // Current version
  repo: string; // DID of repository owner
}
```

### ChangelogFormData

Changelog state for the form.

```typescript
interface ChangelogFormData {
  summary?: string;
  sections: ChangelogSection[];
  reviewerResponse?: string;
}

interface ChangelogSection {
  category: ChangelogCategory;
  items: ChangelogItem[];
}

interface ChangelogItem {
  description: string;
  changeType?: ChangeType;
  location?: string;
  reviewReference?: string;
}
```

### VersionBumpType

```typescript
type VersionBumpType = 'major' | 'minor' | 'patch';
```

### SemanticVersion

```typescript
interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}
```

## Query Key Management

The hooks use a query key factory for cache management.

```typescript
import { changelogKeys, eprintKeys } from '@/lib/hooks/use-eprint-mutations';

// Invalidate all changelog queries
queryClient.invalidateQueries({ queryKey: changelogKeys.all });

// Invalidate changelogs for a specific eprint
queryClient.invalidateQueries({ queryKey: changelogKeys.list(eprintUri) });

// Invalidate a specific eprint
queryClient.invalidateQueries({ queryKey: eprintKeys.detail(uri) });
```

## Error Handling

All mutations throw `APIError` on failure. The error includes:

- `message`: Human-readable error description
- `status`: HTTP status code (if available)
- `endpoint`: XRPC endpoint that failed

```typescript
import { APIError } from '@/lib/errors';

try {
  await updateEprint({ uri, versionBump: 'minor' });
} catch (error) {
  if (error instanceof APIError) {
    if (error.message.includes('swapRecord')) {
      toast.error('Update conflict: record was modified');
    } else if (error.message.includes('Unauthorized')) {
      toast.error('Not authorized to edit this eprint');
    } else {
      toast.error(`Failed to update: ${error.message}`);
    }
  }
}
```

## Testing

Components include comprehensive test coverage. Run tests with:

```bash
pnpm test:unit web/components/eprints
pnpm test:unit web/lib/hooks/use-eprint-mutations.test.ts
```

Key test files:

- `web/components/eprints/eprint-edit-dialog.test.tsx`
- `web/components/eprints/delete-dialog.test.tsx`
- `web/components/eprints/changelog-form.test.tsx`
- `web/components/eprints/version-history.test.tsx`
- `web/components/eprints/paper-auth-gate.test.tsx`
- `web/lib/hooks/use-eprint-mutations.test.ts`

## Related Documentation

- [Editing Eprints (User Guide)](../user-guide/editing-eprints.md): End-user documentation
- [Lexicons Reference](../reference/lexicons.md): Record schemas
- [XRPC Endpoints](../api-reference/xrpc-endpoints.md): Backend API reference
- [Frontend Development](./frontend.md): General frontend architecture
