'use client';

/**
 * Comprehensive eprint author editor component.
 *
 * @remarks
 * Full-featured editor for managing eprint authors with support for:
 * - ATProto users (with DID) and external collaborators (without DID)
 * - CRediT-based contribution types with degree modifiers
 * - Multiple affiliations per author with ROR support
 * - Corresponding author designation
 * - Highlighted author status (co-first, co-last)
 * - Author ordering via drag-and-drop
 *
 * @example
 * ```tsx
 * <EprintAuthorEditor
 *   authors={authors}
 *   onChange={setAuthors}
 *   submitterDid="did:plc:abc123"
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  User,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  ContributionTypeSelector,
  type SelectedContribution,
  type ContributionType,
} from './contribution-type-selector';
import { AffiliationInput, type AuthorAffiliation } from './affiliation-input';
import { DidAutocompleteInput, type SelectedAtprotoUser } from './did-autocomplete-input';
import { OrcidAutocomplete, type OrcidPerson } from './orcid-autocomplete';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Eprint author for form state.
 */
export interface EprintAuthorFormData {
  /** ATProto DID (optional for external collaborators) */
  did?: string;
  /** Display name (required) */
  name: string;
  /** Handle (e.g., @user.bsky.social) */
  handle?: string;
  /** Avatar URL */
  avatar?: string;
  /** ORCID identifier */
  orcid?: string;
  /** Contact email */
  email?: string;
  /** Position in author list (1-indexed) */
  order: number;
  /** Affiliations */
  affiliations: AuthorAffiliation[];
  /** CRediT contributions */
  contributions: SelectedContribution[];
  /** Corresponding author flag */
  isCorrespondingAuthor: boolean;
  /** Highlighted author flag (co-first, co-last) */
  isHighlighted: boolean;
}

/**
 * Props for EprintAuthorEditor.
 */
export interface EprintAuthorEditorProps {
  /** Current list of authors */
  authors: EprintAuthorFormData[];

  /** Callback when authors change */
  onChange: (authors: EprintAuthorFormData[]) => void;

  /** Submitter's DID (first author is typically the submitter) */
  submitterDid?: string;

  /** Submitter's profile info */
  submitterProfile?: {
    handle?: string;
    displayName?: string;
    avatar?: string;
    orcid?: string;
    affiliations?: AuthorAffiliation[];
  };

  /** Available contribution types (from API) */
  contributionTypes?: ContributionType[];

  /** Maximum number of authors */
  maxAuthors?: number;

  /** Disabled state */
  disabled?: boolean;

  /** Import mode - shows "This is me" on existing authors instead of "Add myself" */
  isImportMode?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Info tooltip component for field help.
 */
function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Gets initials from a name.
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Validates ORCID format.
 */
function isValidOrcid(orcid: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid);
}

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates DID format.
 */
function isValidDid(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._:-]+$/.test(did);
}

// =============================================================================
// AUTHOR FORM (Add/Edit)
// =============================================================================

interface AuthorFormProps {
  author?: EprintAuthorFormData;
  onSave: (author: EprintAuthorFormData) => void;
  onCancel: () => void;
  existingDids: Set<string>;
  nextOrder: number;
  disabled?: boolean;
  contributionTypes?: ContributionType[];
  isSubmitter?: boolean;
}

function AuthorForm({
  author,
  onSave,
  onCancel,
  existingDids,
  nextOrder,
  disabled,
  contributionTypes,
  isSubmitter,
}: AuthorFormProps) {
  const isEditing = !!author;

  const [formData, setFormData] = useState<EprintAuthorFormData>(
    author ?? {
      did: undefined,
      name: '',
      handle: undefined,
      avatar: undefined,
      orcid: undefined,
      email: undefined,
      order: nextOrder,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: false,
      isHighlighted: false,
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authorType, setAuthorType] = useState<'atproto' | 'external'>(
    author?.did ? 'atproto' : 'external'
  );

  const handleUserSelect = (user: SelectedAtprotoUser) => {
    setFormData((prev) => ({
      ...prev,
      did: user.did,
      name: user.displayName || prev.name,
      handle: user.handle,
      avatar: user.avatar,
      // Auto-fill ORCID and affiliations from Chive profile if available
      orcid: user.orcid || prev.orcid,
      affiliations: user.affiliations?.length ? user.affiliations : prev.affiliations,
    }));
    setErrors((prev) => ({ ...prev, did: '' }));
  };

  const handleOrcidSelect = (person: OrcidPerson) => {
    setFormData((prev) => ({
      ...prev,
      orcid: person.orcid,
      // Optionally update name if not already set
      name: prev.name || person.name,
    }));
  };

  const handleDidChange = (newDid: string) => {
    setFormData((prev) => ({
      ...prev,
      did: newDid || undefined,
      // Clear profile data if manually entering DID
      ...(newDid.startsWith('did:') ? { handle: undefined, avatar: undefined } : {}),
    }));
  };

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Validate DID for ATProto users
    if (authorType === 'atproto' && formData.did) {
      if (!isValidDid(formData.did)) {
        newErrors.did = 'Invalid DID format';
      } else if (existingDids.has(formData.did) && formData.did !== author?.did) {
        newErrors.did = 'This author has already been added';
      }
    }

    // Validate ORCID if provided
    if (formData.orcid && !isValidOrcid(formData.orcid)) {
      newErrors.orcid = 'Invalid ORCID format (e.g., 0000-0002-1825-0097)';
    }

    // Validate email if provided
    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare final data
    const finalData: EprintAuthorFormData = {
      ...formData,
      did: authorType === 'atproto' ? formData.did : undefined,
      name: formData.name.trim(),
      orcid: formData.orcid?.trim() || undefined,
      email: formData.email?.trim() || undefined,
    };

    onSave(finalData);
  }, [formData, authorType, existingDids, author, onSave]);

  return (
    <div className="space-y-4 rounded-lg border p-4" data-testid="author-form">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{isEditing ? 'Edit Author' : 'Add Author'}</h4>
        {!isSubmitter && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={authorType === 'atproto'}
                onChange={() => setAuthorType('atproto')}
                disabled={disabled || isSubmitter}
                className="h-4 w-4"
              />
              <span className="text-sm">ATProto User</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={authorType === 'external'}
                onChange={() => setAuthorType('external')}
                disabled={disabled || isSubmitter}
                className="h-4 w-4"
              />
              <span className="text-sm">External Collaborator</span>
            </label>
            <InfoTooltip>
              <strong>ATProto users</strong> are linked by their DID and can be invited to the
              platform. <strong>External collaborators</strong> are identified by name/ORCID/email
              for attribution without an ATProto account.
            </InfoTooltip>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* DID field (ATProto only) */}
        {authorType === 'atproto' && !isSubmitter && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="did">ATProto User *</Label>
            <DidAutocompleteInput
              value={formData.did}
              onSelect={handleUserSelect}
              onChange={handleDidChange}
              disabled={disabled}
              error={!!errors.did}
            />
            {errors.did && <p className="text-sm text-destructive">{errors.did}</p>}
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Jane Doe"
            disabled={disabled}
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* ORCID */}
        <div className="space-y-1.5">
          <Label htmlFor="orcid">ORCID</Label>
          <OrcidAutocomplete
            id="orcid"
            value={formData.orcid}
            onSelect={handleOrcidSelect}
            onChange={(value) => setFormData((prev) => ({ ...prev, orcid: value || undefined }))}
            onClear={() => setFormData((prev) => ({ ...prev, orcid: undefined }))}
            placeholder="Search by name or enter ORCID..."
            disabled={disabled}
          />
          {errors.orcid && <p className="text-sm text-destructive">{errors.orcid}</p>}
        </div>

        {/* Email (external authors) */}
        {authorType === 'external' && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value || undefined }))
              }
              placeholder="jane.doe@university.edu"
              disabled={disabled}
              className={cn(errors.email && 'border-destructive')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        )}
      </div>

      {/* Affiliations */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Affiliations</Label>
          <InfoTooltip>
            Add institutional affiliations with optional ROR identifiers for accurate attribution.
            ROR (Research Organization Registry) IDs enable reliable linking to institutions.
          </InfoTooltip>
        </div>
        <AffiliationInput
          affiliations={formData.affiliations}
          onChange={(affiliations) => setFormData((prev) => ({ ...prev, affiliations }))}
          disabled={disabled}
          maxAffiliations={5}
        />
      </div>

      {/* Contributions */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Contributions (CRediT)</Label>
          <InfoTooltip>
            Select contribution types using the CRediT (Contributor Roles Taxonomy) standard. Each
            role can have a degree modifier: <strong>Lead</strong> (primary responsibility),{' '}
            <strong>Equal</strong> (shared equally), or <strong>Supporting</strong> (assisted).
          </InfoTooltip>
        </div>
        <ContributionTypeSelector
          selectedContributions={formData.contributions}
          onChange={(contributions) => setFormData((prev) => ({ ...prev, contributions }))}
          contributionTypes={contributionTypes}
          disabled={disabled}
        />
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="corresponding"
            checked={formData.isCorrespondingAuthor}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                isCorrespondingAuthor: checked === true,
              }))
            }
            disabled={disabled}
          />
          <Label htmlFor="corresponding" className="text-sm font-normal">
            Corresponding Author
          </Label>
          <InfoTooltip>
            The corresponding author is the primary contact for inquiries about the work. At least
            one corresponding author is required.
          </InfoTooltip>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="highlighted"
            checked={formData.isHighlighted}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                isHighlighted: checked === true,
              }))
            }
            disabled={disabled}
          />
          <Label htmlFor="highlighted" className="text-sm font-normal">
            Highlighted (Co-First/Co-Last)
          </Label>
          <InfoTooltip>
            Mark authors who contributed equally as co-first or co-last authors. Multiple
            highlighted authors in the first or last positions indicate equal contribution.
          </InfoTooltip>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={disabled}>
          {isEditing ? 'Update Author' : 'Add Author'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// AUTHOR CARD
// =============================================================================

interface AuthorCardProps {
  author: EprintAuthorFormData;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSubmitter: boolean;
  disabled?: boolean;
  /** Number of highlighted authors (only show Co-First badge if > 1) */
  highlightedCount: number;
  /** Callback when user claims this author as themselves (import mode) */
  onClaimAsMe?: () => void;
  /** Whether to show the "This is me" button */
  showClaimButton?: boolean;
}

function AuthorCard({
  author,
  index,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isSubmitter,
  disabled,
  highlightedCount,
  onClaimAsMe,
  showClaimButton,
}: AuthorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const initials = getInitials(author.name);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        author.isHighlighted && 'border-primary/50 bg-primary/5'
      )}
      data-testid={`author-card-${index}`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Reorder controls */}
        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={disabled || isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Order number */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {index + 1}
        </div>

        {/* Avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          {author.avatar && <AvatarImage src={author.avatar} alt={author.name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        {/* Author info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {author.did ? (
              <a
                href={`/authors/${encodeURIComponent(author.did)}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {author.name}
              </a>
            ) : (
              <span className="font-medium">{author.name}</span>
            )}

            {/* Badges */}
            {isSubmitter && (
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                Submitter
              </span>
            )}
            {author.isCorrespondingAuthor && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                Corresponding
              </span>
            )}
            {author.isHighlighted && highlightedCount > 1 && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Co-First
              </span>
            )}
            {!author.did && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                External
              </span>
            )}
          </div>

          {/* Secondary info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            {author.email && (
              <span className="inline-flex items-center gap-0.5">
                <Mail className="h-3 w-3" />
                {author.email}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {showClaimButton && onClaimAsMe && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onClaimAsMe}
              disabled={disabled}
              className="gap-1"
            >
              <User className="h-3.5 w-3.5" />
              This is me
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide' : 'Details'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={disabled}>
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove author"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Affiliations */}
          {author.affiliations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Affiliations</h5>
              <div className="space-y-1">
                {author.affiliations.map((aff, i) => (
                  <div key={i} className="text-sm">
                    {aff.name}
                    {aff.department && `, ${aff.department}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contributions */}
          {author.contributions.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Contributions</h5>
              <div className="flex flex-wrap gap-1">
                {author.contributions.map((contrib) => (
                  <span key={contrib.typeId} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {contrib.typeLabel} (
                    {contrib.degree.charAt(0).toUpperCase() + contrib.degree.slice(1)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {author.affiliations.length === 0 && author.contributions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No affiliations or contributions specified
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Comprehensive author editor for eprint submissions.
 */
export function EprintAuthorEditor({
  authors,
  onChange,
  submitterDid,
  submitterProfile,
  contributionTypes,
  maxAuthors = 50,
  disabled = false,
  isImportMode = false,
  className,
}: EprintAuthorEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Extract existing DIDs for duplicate checking
  const existingDids = useMemo(
    () => new Set(authors.filter((a) => a.did).map((a) => a.did!)),
    [authors]
  );

  const canAddMore = authors.length < maxAuthors;
  const nextOrder = authors.length + 1;

  // Check if we have at least one corresponding author
  const hasCorresponding = authors.some((a) => a.isCorrespondingAuthor);

  // Count highlighted authors (for Co-First badge display)
  const highlightedCount = authors.filter((a) => a.isHighlighted).length;

  // Check if the current user is already in the author list
  const isUserInAuthorList = submitterDid ? existingDids.has(submitterDid) : false;

  // Handle adding new author
  const handleAddAuthor = useCallback(
    (author: EprintAuthorFormData) => {
      const newAuthors = [...authors, { ...author, order: authors.length + 1 }];
      onChange(newAuthors);
      setShowForm(false);
    },
    [authors, onChange]
  );

  // Handle updating author
  const handleUpdateAuthor = useCallback(
    (index: number, author: EprintAuthorFormData) => {
      const updated = [...authors];
      updated[index] = { ...author, order: index + 1 };
      onChange(updated);
      setEditingIndex(null);
    },
    [authors, onChange]
  );

  // Handle removing author
  const handleRemoveAuthor = useCallback(
    (index: number) => {
      const updated = authors.filter((_, i) => i !== index);
      // Renumber
      updated.forEach((author, i) => {
        author.order = i + 1;
      });
      onChange(updated);
    },
    [authors, onChange]
  );

  // Handle reordering
  const handleMoveAuthor = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= authors.length) return;

      const updated = [...authors];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Renumber
      updated.forEach((author, i) => {
        author.order = i + 1;
      });

      onChange(updated);
    },
    [authors, onChange]
  );

  // Handle "This is me" - claim an existing author as the current user (import mode)
  const handleClaimAuthor = useCallback(
    (index: number) => {
      if (!submitterDid) return;

      const updated = [...authors];
      updated[index] = {
        ...updated[index],
        did: submitterDid,
        handle: submitterProfile?.handle,
        avatar: submitterProfile?.avatar,
        // Merge profile data - prefer existing if already set
        orcid: updated[index].orcid || submitterProfile?.orcid,
        affiliations:
          updated[index].affiliations.length > 0
            ? updated[index].affiliations
            : (submitterProfile?.affiliations ?? []),
      };
      onChange(updated);
    },
    [authors, onChange, submitterDid, submitterProfile]
  );

  // Handle "Add myself" - add the current user as a new author (new submission mode)
  const handleAddMyself = useCallback(() => {
    if (!submitterDid || isUserInAuthorList) return;

    const newAuthor: EprintAuthorFormData = {
      did: submitterDid,
      name: submitterProfile?.displayName ?? submitterProfile?.handle ?? 'Unknown',
      handle: submitterProfile?.handle,
      avatar: submitterProfile?.avatar,
      orcid: submitterProfile?.orcid,
      email: undefined,
      order: authors.length + 1,
      affiliations: submitterProfile?.affiliations ?? [],
      contributions: [],
      isCorrespondingAuthor: false,
      isHighlighted: false,
    };

    onChange([...authors, newAuthor]);
  }, [submitterDid, submitterProfile, authors, onChange, isUserInAuthorList]);

  return (
    <div className={cn('space-y-4', className)} data-testid="eprint-author-editor">
      {/* Validation warning */}
      {!hasCorresponding && authors.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please designate at least one corresponding author</span>
        </div>
      )}

      {/* Author list */}
      {authors.length > 0 && (
        <div className="space-y-2">
          {authors.map((author, index) =>
            editingIndex === index ? (
              <AuthorForm
                key={`edit-${index}`}
                author={author}
                onSave={(updated) => handleUpdateAuthor(index, updated)}
                onCancel={() => setEditingIndex(null)}
                existingDids={existingDids}
                nextOrder={index + 1}
                disabled={disabled}
                contributionTypes={contributionTypes}
                isSubmitter={author.did === submitterDid}
              />
            ) : (
              <AuthorCard
                key={author.did ?? `author-${index}`}
                author={author}
                index={index}
                onEdit={() => setEditingIndex(index)}
                onRemove={() => handleRemoveAuthor(index)}
                onMoveUp={() => handleMoveAuthor(index, index - 1)}
                onMoveDown={() => handleMoveAuthor(index, index + 1)}
                isFirst={index === 0}
                isLast={index === authors.length - 1}
                isSubmitter={author.did === submitterDid}
                disabled={disabled}
                highlightedCount={highlightedCount}
                onClaimAsMe={() => handleClaimAuthor(index)}
                showClaimButton={isImportMode && !author.did && !isUserInAuthorList}
              />
            )
          )}
        </div>
      )}

      {/* Add author form or button */}
      {showForm ? (
        <AuthorForm
          onSave={handleAddAuthor}
          onCancel={() => setShowForm(false)}
          existingDids={existingDids}
          nextOrder={nextOrder}
          disabled={disabled}
          contributionTypes={contributionTypes}
        />
      ) : (
        canAddMore &&
        !disabled &&
        editingIndex === null && (
          <div className="flex items-center gap-2">
            {/* Add myself button - for new submissions when user isn't in the list */}
            {!isImportMode && submitterDid && !isUserInAuthorList && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={handleAddMyself}
              >
                <User className="h-4 w-4" />
                Add myself
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4" />
              Add Author
            </Button>
          </div>
        )
      )}

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Authors are listed in order of contribution. Use arrows to reorder.</span>
        <span>
          {authors.length}/{maxAuthors} authors
        </span>
      </div>
    </div>
  );
}
