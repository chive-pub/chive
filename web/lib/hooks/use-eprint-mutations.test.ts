import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createWrapper } from '@/tests/test-utils';
import { APIError } from '@/lib/errors';

import {
  useDeleteEprint,
  useUpdateEprint,
  useEprintPermissions,
  formatVersion,
} from './use-eprint-mutations';
import { eprintKeys } from './use-eprint';

// Mock functions using vi.hoisted for proper hoisting
const { mockDeleteSubmission, mockUpdateSubmission } = vi.hoisted(() => ({
  mockDeleteSubmission: vi.fn(),
  mockUpdateSubmission: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: {
      chive: {
        eprint: {},
      },
    },
  },
  authApi: {
    pub: {
      chive: {
        eprint: {
          deleteSubmission: mockDeleteSubmission,
          updateSubmission: mockUpdateSubmission,
        },
      },
    },
  },
}));

describe('useDeleteEprint', () => {
  const eprintUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully deletes an eprint and returns success response', async () => {
    const mockResponse = { success: true };
    mockDeleteSubmission.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    const deleteResult = await result.current.mutateAsync({ uri: eprintUri });

    expect(deleteResult).toEqual(mockResponse);
    expect(mockDeleteSubmission).toHaveBeenCalledWith({ uri: eprintUri });
  });

  it('invalidates eprint queries on successful deletion', async () => {
    mockDeleteSubmission.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    await result.current.mutateAsync({ uri: eprintUri });

    // Wait for onSuccess to complete
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: eprintKeys.detail(eprintUri),
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: eprintKeys.all,
      });
    });
  });

  it('throws APIError when deletion is unauthorized', async () => {
    const apiError = new APIError('Not authorized to delete this eprint', 403, 'deleteSubmission');
    mockDeleteSubmission.mockRejectedValueOnce(apiError);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: eprintUri })).rejects.toThrow(
      'Not authorized to delete this eprint'
    );
  });

  it('throws APIError when eprint is not found', async () => {
    const apiError = new APIError('Eprint not found', 404, 'deleteSubmission');
    mockDeleteSubmission.mockRejectedValueOnce(apiError);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: eprintUri })).rejects.toThrow(
      'Eprint not found'
    );
  });

  it('wraps non-APIError errors in APIError', async () => {
    mockDeleteSubmission.mockRejectedValueOnce(new Error('Network failure'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ uri: eprintUri })).rejects.toMatchObject({
      message: 'Network failure',
    });
  });

  it('sets isPending state during deletion', async () => {
    // Create a promise that we control
    let resolvePromise: (value: { data: { success: boolean } }) => void;
    const pendingPromise = new Promise<{ data: { success: boolean } }>((resolve) => {
      resolvePromise = resolve;
    });
    mockDeleteSubmission.mockReturnValueOnce(pendingPromise);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteEprint(), { wrapper: Wrapper });

    // Start the mutation
    const mutationPromise = result.current.mutateAsync({ uri: eprintUri });

    // Check pending state
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({ data: { success: true } });

    // Wait for mutation to complete
    await mutationPromise;

    // Wait for state to settle after mutation completes
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});

describe('useUpdateEprint', () => {
  const eprintUri = 'at://did:plc:user123/pub.chive.eprint.submission/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully updates an eprint with minor version bump', async () => {
    const mockResponse = {
      uri: eprintUri,
      version: { major: 1, minor: 1, patch: 0 },
      expectedCid: 'bafyreiabc123',
    };
    mockUpdateSubmission.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    const updateResult = await result.current.mutateAsync({
      uri: eprintUri,
      versionBump: 'minor',
    });

    expect(updateResult).toEqual(mockResponse);
    expect(mockUpdateSubmission).toHaveBeenCalledWith({
      uri: eprintUri,
      versionBump: 'minor',
    });
  });

  it('successfully updates an eprint with major version bump', async () => {
    const mockResponse = {
      uri: eprintUri,
      version: { major: 2, minor: 0, patch: 0 },
      expectedCid: 'bafyreiabc456',
    };
    mockUpdateSubmission.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    const updateResult = await result.current.mutateAsync({
      uri: eprintUri,
      versionBump: 'major',
    });

    expect(updateResult.version).toEqual({ major: 2, minor: 0, patch: 0 });
  });

  it('successfully updates an eprint with patch version bump', async () => {
    const mockResponse = {
      uri: eprintUri,
      version: { major: 1, minor: 0, patch: 1 },
      expectedCid: 'bafyreiabc789',
    };
    mockUpdateSubmission.mockResolvedValueOnce({ data: mockResponse });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    const updateResult = await result.current.mutateAsync({
      uri: eprintUri,
      versionBump: 'patch',
    });

    expect(updateResult.version).toEqual({ major: 1, minor: 0, patch: 1 });
  });

  it('returns new version in response', async () => {
    const expectedVersion = { major: 1, minor: 2, patch: 3 };
    mockUpdateSubmission.mockResolvedValueOnce({
      data: {
        uri: eprintUri,
        version: expectedVersion,
        expectedCid: 'bafyreicid123',
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    const updateResult = await result.current.mutateAsync({
      uri: eprintUri,
      versionBump: 'minor',
    });

    expect(updateResult.version).toEqual(expectedVersion);
    expect(updateResult.version.major).toBe(1);
    expect(updateResult.version.minor).toBe(2);
    expect(updateResult.version.patch).toBe(3);
  });

  it('invalidates eprint queries on successful update', async () => {
    mockUpdateSubmission.mockResolvedValueOnce({
      data: {
        uri: eprintUri,
        version: { major: 1, minor: 1, patch: 0 },
        expectedCid: 'bafyreiabc123',
      },
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    await result.current.mutateAsync({ uri: eprintUri, versionBump: 'minor' });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: eprintKeys.detail(eprintUri),
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: eprintKeys.all,
      });
    });
  });

  it('throws APIError when update is unauthorized', async () => {
    const apiError = new APIError('Not authorized to update this eprint', 403, 'updateSubmission');
    mockUpdateSubmission.mockRejectedValueOnce(apiError);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ uri: eprintUri, versionBump: 'minor' })
    ).rejects.toThrow('Not authorized to update this eprint');
  });

  it('throws APIError when eprint is not found', async () => {
    const apiError = new APIError('Eprint not found', 404, 'updateSubmission');
    mockUpdateSubmission.mockRejectedValueOnce(apiError);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ uri: eprintUri, versionBump: 'minor' })
    ).rejects.toThrow('Eprint not found');
  });

  it('wraps non-APIError errors in APIError', async () => {
    mockUpdateSubmission.mockRejectedValueOnce(new Error('Connection timeout'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEprint(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ uri: eprintUri, versionBump: 'patch' })
    ).rejects.toMatchObject({
      message: 'Connection timeout',
    });
  });
});

describe('useEprintPermissions', () => {
  const submitterDid = 'did:plc:submitter123';
  const otherUserDid = 'did:plc:other456';
  const paperDid = 'did:plc:paper789';

  describe('when not authenticated', () => {
    it('returns canModify=false when userDid is undefined', () => {
      const eprint = { submittedBy: submitterDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, undefined), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(false);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBe('Not authenticated');
    });

    it('returns canModify=false when eprint is undefined', () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(undefined, submitterDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(false);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBe('Not authenticated');
    });

    it('returns canModify=false when both are undefined', () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(undefined, undefined), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(false);
      expect(result.current.requiresPaperAuth).toBe(false);
    });
  });

  describe('for traditional eprints (no paperDid)', () => {
    it('returns canModify=true for the submitter', () => {
      const eprint = { submittedBy: submitterDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, submitterDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(true);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });

    it('returns canModify=false for non-submitter users', () => {
      const eprint = { submittedBy: submitterDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, otherUserDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(false);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBe('Not authorized');
    });

    it('does not require paper auth for traditional eprints', () => {
      const eprint = { submittedBy: submitterDid, paperDid: undefined };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, submitterDid), {
        wrapper: Wrapper,
      });

      expect(result.current.requiresPaperAuth).toBe(false);
    });
  });

  describe('for paper-centric eprints (has paperDid)', () => {
    it('returns requiresPaperAuth=true for submitter who is not authenticated as paper', () => {
      const eprint = { submittedBy: submitterDid, paperDid: paperDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, submitterDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(true);
      expect(result.current.requiresPaperAuth).toBe(true);
      expect(result.current.reason).toBe('Paper authentication required');
    });

    it('returns canModify=true and requiresPaperAuth=false when authenticated as paper account', () => {
      const eprint = { submittedBy: submitterDid, paperDid: paperDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, paperDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(true);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBeUndefined();
    });

    it('returns canModify=false for users who are neither submitter nor paper owner', () => {
      const eprint = { submittedBy: submitterDid, paperDid: paperDid };

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useEprintPermissions(eprint, otherUserDid), {
        wrapper: Wrapper,
      });

      expect(result.current.canModify).toBe(false);
      expect(result.current.requiresPaperAuth).toBe(false);
      expect(result.current.reason).toBe('Not authorized');
    });
  });
});

describe('formatVersion', () => {
  it('formats a basic semantic version correctly', () => {
    const version = { major: 1, minor: 2, patch: 3 };
    expect(formatVersion(version)).toBe('1.2.3');
  });

  it('formats version 1.0.0 correctly', () => {
    const version = { major: 1, minor: 0, patch: 0 };
    expect(formatVersion(version)).toBe('1.0.0');
  });

  it('formats version with zeros correctly', () => {
    const version = { major: 0, minor: 0, patch: 1 };
    expect(formatVersion(version)).toBe('0.0.1');
  });

  it('formats version with large numbers', () => {
    const version = { major: 10, minor: 20, patch: 30 };
    expect(formatVersion(version)).toBe('10.20.30');
  });

  it('includes prerelease identifier when present', () => {
    const version = { major: 1, minor: 0, patch: 0, prerelease: 'draft' };
    expect(formatVersion(version)).toBe('1.0.0-draft');
  });

  it('handles prerelease with release candidate identifier', () => {
    const version = { major: 2, minor: 0, patch: 0, prerelease: 'rc1' };
    expect(formatVersion(version)).toBe('2.0.0-rc1');
  });

  it('handles prerelease with alpha/beta identifiers', () => {
    expect(formatVersion({ major: 1, minor: 0, patch: 0, prerelease: 'alpha' })).toBe(
      '1.0.0-alpha'
    );
    expect(formatVersion({ major: 1, minor: 0, patch: 0, prerelease: 'beta.1' })).toBe(
      '1.0.0-beta.1'
    );
  });

  it('does not include hyphen when prerelease is undefined', () => {
    const version = { major: 1, minor: 2, patch: 3, prerelease: undefined };
    expect(formatVersion(version)).toBe('1.2.3');
  });

  it('does not include hyphen when prerelease is empty string', () => {
    const version = { major: 1, minor: 2, patch: 3, prerelease: '' };
    // Empty string is falsy, so it should not include the prerelease
    expect(formatVersion(version)).toBe('1.2.3');
  });
});
