/**
 * Draft persistence for the eprint submission wizard.
 *
 * @remarks
 * The wizard collects nine steps of input before anything is written to the
 * user's PDS. Until submission there is no server-side record of that work, so
 * a refresh, a back-navigation, or a closed tab used to discard all of it.
 * This module keeps a copy in `localStorage` so the wizard can offer it back.
 *
 * **Files are not persisted.** `File` handles cannot survive a page load, and
 * copying document bytes into `localStorage` would both blow the storage quota
 * and put user document content somewhere Chive has no business keeping it.
 * The draft records file *names* instead, so the wizard can name what the user
 * needs to re-attach rather than silently dropping a step.
 *
 * **Drafts are scoped** by account DID and by submission source. A claim-mode
 * draft is keyed to the paper being claimed, so restoring can never graft one
 * import's edits onto a different paper.
 *
 * @packageDocumentation
 */

/** Storage key prefix. The version segment lets a shape change orphan old drafts. */
const DRAFT_KEY_PREFIX = 'chive:wizard-draft:v1';

/** Drafts older than this are treated as absent rather than offered back. */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Form keys holding `File` values, which are dropped on save. */
const FILE_KEYS = ['documentFile', 'supplementaryFiles'] as const;

/**
 * A draft as stored, with file handles replaced by their names.
 *
 * @public
 */
export interface StoredDraft<TValues = Record<string, unknown>> {
  /** Zero-based wizard step the user had reached. */
  step: number;
  /** Form values with every `File` removed. */
  values: Partial<TValues>;
  /** Names of files the user had attached and must attach again. */
  missingFiles: string[];
  /** Epoch milliseconds when the draft was written. */
  savedAt: number;
}

/**
 * Build the scope segment identifying which submission a draft belongs to.
 *
 * @param prefilled - Claim-mode source data, if any
 * @returns `'submit'` for a fresh submission, or a claim scope tied to the source paper
 *
 * @remarks
 * Claim mode starts from an external paper. Keying its draft by that paper's
 * identity means a restore either matches the paper on screen or does not fire
 * at all. Falling back to the title keeps sources that carry neither an arXiv
 * ID nor a DOI separated from one another.
 *
 * @public
 */
export function draftScope(prefilled?: {
  doi?: string;
  externalId?: string;
  title?: string;
  externalIds?: { arxivId?: string; doi?: string };
}): string {
  if (!prefilled) return 'submit';
  const identity =
    prefilled.externalIds?.arxivId ??
    prefilled.doi ??
    prefilled.externalIds?.doi ??
    prefilled.externalId ??
    prefilled.title;
  if (!identity) return 'claim';
  // Collapse to a compact, key-safe token; collisions only ever merge drafts
  // for papers with identical identifiers, which are the same paper.
  return `claim:${identity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 96)}`;
}

function draftKey(did: string, scope: string): string {
  return `${DRAFT_KEY_PREFIX}:${did}:${scope}`;
}

/**
 * Read `localStorage`, tolerating browsers that make access throw.
 *
 * @remarks
 * Private-mode Safari and cookie-blocking settings throw on property access
 * rather than returning null, and the wizard must keep working in those cases.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Strip `File` values from form data and collect their names.
 *
 * @param values - Raw form values
 * @returns Serializable values plus the names of the files that were removed
 */
export function stripFiles<TValues extends object>(
  values: TValues
): { values: Partial<TValues>; missingFiles: string[] } {
  const missingFiles: string[] = [];
  const out: Record<string, unknown> = { ...(values as Record<string, unknown>) };

  for (const key of FILE_KEYS) {
    const value = out[key];
    if (value instanceof File) {
      missingFiles.push(value.name);
      delete out[key];
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry instanceof File) missingFiles.push(entry.name);
      }
      delete out[key];
    }
  }

  // Supplementary materials carry a File alongside metadata worth keeping, so
  // the entries survive with the handle removed.
  const materials = out.supplementaryMaterials;
  if (Array.isArray(materials)) {
    out.supplementaryMaterials = materials.map((material) => {
      if (material === null || typeof material !== 'object') return material;
      const { file, ...rest } = material as { file?: unknown };
      if (file instanceof File) missingFiles.push(file.name);
      return rest;
    });
  }

  return { values: out as Partial<TValues>, missingFiles };
}

/**
 * Write a draft for the given account and scope.
 *
 * @param did - Account DID the draft belongs to
 * @param scope - Result of {@link draftScope}
 * @param draft - Step and form values to persist
 * @returns Whether the draft was written
 *
 * @remarks
 * Returns `false` rather than throwing when storage is unavailable or the
 * quota is exhausted. Draft persistence is a convenience; failing to save one
 * must never interrupt a submission in progress.
 */
export function saveDraft<TValues extends object>(
  did: string,
  scope: string,
  draft: { step: number; values: TValues; savedAt: number }
): boolean {
  const store = storage();
  if (!store) return false;

  const { values, missingFiles } = stripFiles(draft.values);
  const payload: StoredDraft<TValues> = {
    step: draft.step,
    values,
    missingFiles,
    savedAt: draft.savedAt,
  };

  try {
    store.setItem(draftKey(did, scope), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a draft, if one exists and has not expired.
 *
 * @param did - Account DID the draft belongs to
 * @param scope - Result of {@link draftScope}
 * @param now - Current epoch milliseconds
 * @returns The stored draft, or `null` when absent, expired, or unreadable
 *
 * @remarks
 * A draft that fails to parse is deleted rather than returned. Leaving corrupt
 * data in place would make every subsequent mount attempt the same failed read.
 */
export function loadDraft<TValues extends object>(
  did: string,
  scope: string,
  now: number
): StoredDraft<TValues> | null {
  const store = storage();
  if (!store) return null;

  const key = draftKey(did, scope);
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDraft(did, scope);
    return null;
  }

  if (parsed === null || typeof parsed !== 'object') {
    clearDraft(did, scope);
    return null;
  }

  const draft = parsed as Partial<StoredDraft<TValues>>;
  if (
    typeof draft.step !== 'number' ||
    typeof draft.savedAt !== 'number' ||
    draft.values === null ||
    typeof draft.values !== 'object'
  ) {
    clearDraft(did, scope);
    return null;
  }

  if (now - draft.savedAt > DRAFT_MAX_AGE_MS) {
    clearDraft(did, scope);
    return null;
  }

  return {
    step: draft.step,
    values: draft.values,
    missingFiles: Array.isArray(draft.missingFiles) ? draft.missingFiles : [],
    savedAt: draft.savedAt,
  };
}

/**
 * Delete a draft.
 *
 * @param did - Account DID the draft belongs to
 * @param scope - Result of {@link draftScope}
 */
export function clearDraft(did: string, scope: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(draftKey(did, scope));
  } catch {
    // Nothing to do; the draft simply outlives this attempt.
  }
}

/**
 * Report whether a draft holds anything worth restoring.
 *
 * @param draft - A draft read by {@link loadDraft}
 * @returns Whether the draft carries user input beyond wizard defaults
 *
 * @remarks
 * A user who opens the wizard, types nothing, and leaves still triggers a
 * save. Offering that back as a "restored draft" is noise, so the wizard uses
 * this to decide whether to prompt.
 */
export function draftHasContent(draft: StoredDraft<object>): boolean {
  const v = draft.values as Record<string, unknown>;
  const nonEmpty = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return false;
  };

  return (
    nonEmpty(v.title) ||
    nonEmpty(v.abstract) ||
    nonEmpty(v.keywords) ||
    nonEmpty(v.authors) ||
    nonEmpty(v.fieldNodes) ||
    nonEmpty(v.facets) ||
    nonEmpty(v.supplementaryMaterials) ||
    draft.missingFiles.length > 0
  );
}
