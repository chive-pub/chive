'use client';

/**
 * Author input component for managing co-authors.
 *
 * @remarks
 * Provides an interface for adding and removing co-authors from an eprint.
 * Supports DID-based author lookup and display.
 *
 * @example
 * ```tsx
 * <AuthorInput
 *   authors={authors}
 *   onAuthorAdd={handleAdd}
 *   onAuthorRemove={handleRemove}
 *   onAuthorReorder={handleReorder}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { Plus, X, GripVertical, User, ExternalLink } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { DidAutocompleteInput, type SelectedAtprotoUser } from './did-autocomplete-input';
import { OrcidAutocomplete, type OrcidPerson } from './orcid-autocomplete';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Author reference for form state.
 */
export interface AuthorRef {
  /** ATProto DID */
  did: string;
  /** Display name */
  displayName?: string;
  /** Handle (e.g., @user.bsky.social) */
  handle?: string;
  /** Avatar URL */
  avatar?: string;
  /** ORCID identifier */
  orcid?: string;
  /** Whether this author is the primary (submitting) author */
  isPrimary?: boolean;
}

/**
 * Props for AuthorInput component.
 */
export interface AuthorInputProps {
  /** Current list of authors */
  authors: AuthorRef[];

  /** Callback when author is added */
  onAuthorAdd: (author: AuthorRef) => void;

  /** Callback when author is removed */
  onAuthorRemove: (author: AuthorRef) => void;

  /** Callback when authors are reordered */
  onAuthorReorder?: (authors: AuthorRef[]) => void;

  /** Maximum number of authors allowed */
  maxAuthors?: number;

  /** Disabled state */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Label for the author list */
  label?: string;

  /** Help text displayed below input */
  helpText?: string;

  /** Whether to show the primary author (first author is always primary) */
  showPrimaryBadge?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Gets initials from a display name.
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Shortens a DID for display.
 */
function shortenDid(did: string): string {
  if (did.length <= 20) return did;
  return `${did.slice(0, 12)}...${did.slice(-6)}`;
}

/**
 * Validates a DID format.
 */
function isValidDid(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._:-]+$/.test(did);
}

/**
 * Validates an ORCID format.
 */
function isValidOrcid(orcid: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid);
}

// =============================================================================
// AUTHOR CARD COMPONENT
// =============================================================================

interface AuthorCardProps {
  author: AuthorRef;
  index: number;
  onRemove: () => void;
  disabled?: boolean;
  showPrimaryBadge?: boolean;
  draggable?: boolean;
}

function AuthorCard({
  author,
  index,
  onRemove,
  disabled,
  showPrimaryBadge,
  draggable,
}: AuthorCardProps) {
  const displayName = author.displayName || author.handle || shortenDid(author.did);
  const initials = getInitials(displayName);
  const isPrimary = index === 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
      data-testid={`author-card-${index}`}
    >
      {draggable && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}

      <Avatar className="h-9 w-9 shrink-0">
        {author.avatar && <AvatarImage src={author.avatar} alt={displayName} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayName}</span>
          {showPrimaryBadge && isPrimary && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Primary
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {author.handle && <span>@{author.handle}</span>}
          {author.orcid && (
            <a
              href={`https://orcid.org/${author.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              ORCID
            </a>
          )}
        </div>
      </div>

      {!isPrimary && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={`Remove ${displayName}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// ADD AUTHOR FORM
// =============================================================================

interface AddAuthorFormProps {
  onAdd: (author: AuthorRef) => void;
  existingDids: Set<string>;
  disabled?: boolean;
}

function AddAuthorForm({ onAdd, existingDids, disabled }: AddAuthorFormProps) {
  const [did, setDid] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState<string | undefined>();
  const [avatar, setAvatar] = useState<string | undefined>();
  const [orcid, setOrcid] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleUserSelect = useCallback((user: SelectedAtprotoUser) => {
    setDid(user.did);
    setDisplayName(user.displayName ?? '');
    setHandle(user.handle);
    setAvatar(user.avatar);
    // Auto-fill ORCID from Chive profile if available
    if (user.orcid) {
      setOrcid(user.orcid);
    }
    setError(null);
  }, []);

  const handleDidChange = useCallback((newDid: string) => {
    setDid(newDid);
    // Clear profile data if manually entering DID
    if (newDid.startsWith('did:')) {
      setHandle(undefined);
      setAvatar(undefined);
    }
  }, []);

  const handleOrcidSelect = useCallback(
    (person: OrcidPerson) => {
      setOrcid(person.orcid);
      // Optionally update display name if not already set
      if (!displayName) {
        setDisplayName(person.name);
      }
    },
    [displayName]
  );

  const handleAddAuthor = useCallback(() => {
    setError(null);

    const trimmedDid = did.trim();
    const trimmedName = displayName.trim();
    const trimmedOrcid = orcid.trim();

    if (!trimmedDid) {
      setError('DID is required');
      return;
    }

    if (!isValidDid(trimmedDid)) {
      setError('Invalid DID format (e.g., did:plc:abc123)');
      return;
    }

    if (existingDids.has(trimmedDid)) {
      setError('This author has already been added');
      return;
    }

    if (trimmedOrcid && !isValidOrcid(trimmedOrcid)) {
      setError('Invalid ORCID format (e.g., 0000-0002-1825-0097)');
      return;
    }

    onAdd({
      did: trimmedDid,
      displayName: trimmedName || undefined,
      handle,
      avatar,
      orcid: trimmedOrcid || undefined,
    });

    setDid('');
    setDisplayName('');
    setHandle(undefined);
    setAvatar(undefined);
    setOrcid('');
  }, [did, displayName, handle, avatar, orcid, existingDids, onAdd]);

  // Handle Enter key press in inputs
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddAuthor();
      }
    },
    [handleAddAuthor]
  );

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-testid="author-form">
      <div className="flex items-center gap-2 text-sm font-medium">
        <User className="h-4 w-4" />
        Add Co-Author
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">ATProto User *</label>
        <DidAutocompleteInput
          value={did}
          onSelect={handleUserSelect}
          onChange={handleDidChange}
          disabled={disabled}
          error={!!error && !did}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Display Name</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jane Doe"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">ORCID (optional)</label>
        <OrcidAutocomplete
          value={orcid}
          onSelect={handleOrcidSelect}
          onChange={setOrcid}
          onClear={() => setOrcid('')}
          placeholder="Search by name or enter ORCID..."
          disabled={disabled}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        size="sm"
        disabled={disabled}
        className="gap-1.5"
        onClick={handleAddAuthor}
      >
        <Plus className="h-4 w-4" />
        Add Author
      </Button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Input for managing a list of co-authors.
 *
 * @param props - Component props
 * @returns Author input element
 */
export function AuthorInput({
  authors,
  onAuthorAdd,
  onAuthorRemove,
  onAuthorReorder,
  maxAuthors = 20,
  disabled = false,
  className,
  label,
  helpText,
  showPrimaryBadge = true,
}: AuthorInputProps) {
  const existingDids = new Set(authors.map((a) => a.did));
  const canAddMore = authors.length < maxAuthors;

  const handleRemove = useCallback(
    (author: AuthorRef) => {
      onAuthorRemove(author);
    },
    [onAuthorRemove]
  );

  return (
    <div className={cn('space-y-4', className)} data-testid="author-input">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Author list */}
      {authors.length > 0 && (
        <div className="space-y-2">
          {authors.map((author, index) => (
            <AuthorCard
              key={author.did}
              author={author}
              index={index}
              onRemove={() => handleRemove(author)}
              disabled={disabled}
              showPrimaryBadge={showPrimaryBadge}
              draggable={!!onAuthorReorder && authors.length > 1}
            />
          ))}
        </div>
      )}

      {/* Add author form */}
      {canAddMore && !disabled && (
        <AddAuthorForm onAdd={onAuthorAdd} existingDids={existingDids} disabled={disabled} />
      )}

      {/* Help text and count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {helpText && <span>{helpText}</span>}
        <span className="ml-auto">
          {authors.length}/{maxAuthors} authors
        </span>
      </div>
    </div>
  );
}
