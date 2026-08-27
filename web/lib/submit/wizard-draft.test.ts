import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  DRAFT_MAX_AGE_MS,
  clearDraft,
  draftHasContent,
  draftScope,
  loadDraft,
  saveDraft,
  stripFiles,
} from './wizard-draft';

const DID = 'did:plc:abc123';

function makeFile(name: string): File {
  return new File(['content'], name, { type: 'application/pdf' });
}

describe('draftScope', () => {
  it('returns the plain submit scope when there is no source paper', () => {
    expect(draftScope(undefined)).toBe('submit');
  });

  it('prefers the arXiv id, so the same paper always resolves to one scope', () => {
    const scope = draftScope({ externalIds: { arxivId: '2401.01234' }, doi: '10.1/x', title: 'T' });
    expect(scope).toBe('claim:2401-01234');
  });

  it('falls back through DOI and then title', () => {
    expect(draftScope({ doi: '10.1000/Xyz' })).toBe('claim:10-1000-xyz');
    expect(draftScope({ title: 'A Study of Things' })).toBe('claim:a-study-of-things');
  });

  it('separates two different claim sources', () => {
    expect(draftScope({ doi: '10.1/a' })).not.toBe(draftScope({ doi: '10.1/b' }));
  });

  it('bounds the scope length so the key cannot grow without limit', () => {
    const scope = draftScope({ title: 'word '.repeat(200) });
    expect(scope.length).toBeLessThanOrEqual('claim:'.length + 96);
  });
});

describe('stripFiles', () => {
  it('removes the document file and records its name', () => {
    const { values, missingFiles } = stripFiles({
      title: 'T',
      documentFile: makeFile('paper.pdf'),
    });
    expect(values).not.toHaveProperty('documentFile');
    expect(values.title).toBe('T');
    expect(missingFiles).toEqual(['paper.pdf']);
  });

  it('removes supplementary file arrays', () => {
    const { values, missingFiles } = stripFiles({
      supplementaryFiles: [makeFile('a.csv'), makeFile('b.csv')],
    });
    expect(values).not.toHaveProperty('supplementaryFiles');
    expect(missingFiles).toEqual(['a.csv', 'b.csv']);
  });

  it('keeps supplementary material metadata while dropping the handle', () => {
    const { values, missingFiles } = stripFiles({
      supplementaryMaterials: [
        { file: makeFile('data.zip'), label: 'Dataset', category: 'dataset', order: 1 },
      ],
    });
    const materials = values.supplementaryMaterials as Array<Record<string, unknown>>;
    expect(materials[0]).toEqual({ label: 'Dataset', category: 'dataset', order: 1 });
    expect(materials[0]).not.toHaveProperty('file');
    expect(missingFiles).toEqual(['data.zip']);
  });

  it('produces something JSON can serialize', () => {
    const { values } = stripFiles({ title: 'T', documentFile: makeFile('p.pdf') });
    expect(() => JSON.stringify(values)).not.toThrow();
  });
});

describe('saveDraft and loadDraft', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips values and the step', () => {
    saveDraft(DID, 'submit', {
      step: 4,
      values: { title: 'Held', keywords: ['a'] },
      savedAt: 1000,
    });

    const draft = loadDraft(DID, 'submit', 2000);
    expect(draft?.step).toBe(4);
    expect(draft?.values).toEqual({ title: 'Held', keywords: ['a'] });
    expect(draft?.savedAt).toBe(1000);
  });

  it('keeps drafts for different accounts apart', () => {
    saveDraft(DID, 'submit', { step: 1, values: { title: 'Mine' }, savedAt: 1000 });
    expect(loadDraft('did:plc:other', 'submit', 2000)).toBeNull();
  });

  it('keeps drafts for different sources apart', () => {
    saveDraft(DID, 'claim:one', { step: 1, values: { title: 'One' }, savedAt: 1000 });
    expect(loadDraft(DID, 'claim:two', 2000)).toBeNull();
  });

  it('returns null and deletes a draft past the age limit', () => {
    saveDraft(DID, 'submit', { step: 1, values: { title: 'Old' }, savedAt: 0 });
    expect(loadDraft(DID, 'submit', DRAFT_MAX_AGE_MS + 1)).toBeNull();
    // Deleted rather than merely hidden, so it cannot resurface via a clock change.
    expect(loadDraft(DID, 'submit', 1)).toBeNull();
  });

  it('keeps a draft that is exactly at the age limit', () => {
    saveDraft(DID, 'submit', { step: 1, values: { title: 'Edge' }, savedAt: 0 });
    expect(loadDraft(DID, 'submit', DRAFT_MAX_AGE_MS)).not.toBeNull();
  });

  it('discards unparseable stored data instead of returning it', () => {
    window.localStorage.setItem(`chive:wizard-draft:v1:${DID}:submit`, '{not json');
    expect(loadDraft(DID, 'submit', 1000)).toBeNull();
    expect(window.localStorage.getItem(`chive:wizard-draft:v1:${DID}:submit`)).toBeNull();
  });

  it('discards a draft missing required fields', () => {
    window.localStorage.setItem(
      `chive:wizard-draft:v1:${DID}:submit`,
      JSON.stringify({ values: { title: 'T' } })
    );
    expect(loadDraft(DID, 'submit', 1000)).toBeNull();
  });

  it('does not persist file handles', () => {
    saveDraft(DID, 'submit', {
      step: 0,
      values: { title: 'T', documentFile: makeFile('secret.pdf') },
      savedAt: 1000,
    });
    const raw = window.localStorage.getItem(`chive:wizard-draft:v1:${DID}:submit`) ?? '';
    expect(raw).not.toContain('content');
    expect(loadDraft(DID, 'submit', 2000)?.missingFiles).toEqual(['secret.pdf']);
  });

  it('clears a draft on request', () => {
    saveDraft(DID, 'submit', { step: 1, values: { title: 'T' }, savedAt: 1000 });
    clearDraft(DID, 'submit');
    expect(loadDraft(DID, 'submit', 2000)).toBeNull();
  });

  it('reports failure rather than throwing when the quota is exhausted', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(saveDraft(DID, 'submit', { step: 1, values: { title: 'T' }, savedAt: 1 })).toBe(false);
    spy.mockRestore();
  });

  it('returns null rather than throwing when storage access is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(loadDraft(DID, 'submit', 1000)).toBeNull();
    spy.mockRestore();
  });
});

describe('draftHasContent', () => {
  const base = { step: 0, savedAt: 0, missingFiles: [] as string[] };

  it('rejects a draft holding only wizard defaults', () => {
    expect(
      draftHasContent({
        ...base,
        values: { title: '', abstract: '', keywords: [], authors: [], fieldNodes: [] },
      })
    ).toBe(false);
  });

  it('rejects whitespace-only text', () => {
    expect(draftHasContent({ ...base, values: { title: '   ' } })).toBe(false);
  });

  it('accepts a draft with a title', () => {
    expect(draftHasContent({ ...base, values: { title: 'Real' } })).toBe(true);
  });

  it('accepts a draft whose only content is an attached file', () => {
    expect(draftHasContent({ ...base, missingFiles: ['p.pdf'], values: {} })).toBe(true);
  });

  it('accepts a draft carrying only authors', () => {
    expect(draftHasContent({ ...base, values: { authors: [{ name: 'A' }] } })).toBe(true);
  });
});

describe('storage in a non-browser context', () => {
  const original = globalThis.window;

  afterEach(() => {
    globalThis.window = original;
  });

  it('treats a missing window as no storage rather than crashing', () => {
    // @ts-expect-error deliberately simulating a server render
    delete globalThis.window;
    expect(saveDraft(DID, 'submit', { step: 0, values: {}, savedAt: 0 })).toBe(false);
    expect(loadDraft(DID, 'submit', 0)).toBeNull();
    expect(() => clearDraft(DID, 'submit')).not.toThrow();
  });
});
