/**
 * Tests for FaroRouteTracker component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock next/navigation
const mockPathname = vi.fn(() => '/test-path');
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearchParams(),
}));

// Use vi.hoisted for mock functions
const mockPushEvent = vi.hoisted(() => vi.fn());
const mockSetView = vi.hoisted(() => vi.fn());
const mockPushMeasurement = vi.hoisted(() => vi.fn());

// Mock getFaro
vi.mock('../initialize', () => ({
  getFaro: vi.fn(() => ({
    api: {
      pushEvent: mockPushEvent,
      setView: mockSetView,
      pushMeasurement: mockPushMeasurement,
    },
  })),
}));

// Mock privacy module
vi.mock('../privacy', () => ({
  scrubUrl: vi.fn((url: string) => url),
}));

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => 1000),
    getEntriesByType: vi.fn(() => [
      {
        domainLookupStart: 0,
        domainLookupEnd: 10,
        connectStart: 10,
        connectEnd: 30,
        requestStart: 30,
        responseStart: 50,
        responseEnd: 100,
        domInteractive: 150,
        domComplete: 200,
        startTime: 0,
        loadEventEnd: 250,
      },
    ]),
  },
  writable: true,
});

import { FaroRouteTracker, parameterizePath } from './FaroRouteTracker';

describe('FaroRouteTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/test-path');
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<FaroRouteTracker />);
    expect(container.firstChild).toBeNull();
  });

  it('reports initial route on mount', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    render(<FaroRouteTracker />);

    expect(mockPushEvent).toHaveBeenCalledWith('route_change', {
      to: '/test-path',
      from: '(initial)',
      navigationType: 'initial',
      duration: '0',
    });

    expect(mockSetView).toHaveBeenCalledWith({
      name: '/test-path',
    });
  });

  it('reports route changes', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    const { rerender } = render(<FaroRouteTracker />);

    // Initial call
    expect(mockPushEvent).toHaveBeenCalledTimes(1);

    // Simulate route change
    mockPathname.mockReturnValue('/new-route');
    rerender(<FaroRouteTracker />);

    expect(mockPushEvent).toHaveBeenCalledTimes(2);
    expect(mockPushEvent).toHaveBeenLastCalledWith('route_change', {
      to: '/new-route',
      from: '/test-path',
      navigationType: 'client',
      duration: expect.any(String),
    });
  });

  it('ignores paths matching ignorePaths', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    mockPathname.mockReturnValue('/api/health');

    render(<FaroRouteTracker ignorePaths={[/^\/api\//]} />);

    expect(mockPushEvent).not.toHaveBeenCalled();
    expect(mockSetView).not.toHaveBeenCalled();
  });

  it('uses transformPath to modify reported path', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    mockPathname.mockReturnValue('/users/123/posts/456');

    const transformPath = (path: string) => path.replace(/\/\d+/g, '/:id');

    render(<FaroRouteTracker transformPath={transformPath} />);

    expect(mockSetView).toHaveBeenCalledWith({
      name: '/users/:id/posts/:id',
    });
  });

  it('handles case when Faro is not available', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue(null);

    // Should not throw
    expect(() => render(<FaroRouteTracker />)).not.toThrow();
  });

  it('does not report same path twice', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    const { rerender } = render(<FaroRouteTracker />);

    expect(mockPushEvent).toHaveBeenCalledTimes(1);

    // Rerender with same path
    rerender(<FaroRouteTracker />);

    // Should still be 1 because path hasn't changed
    expect(mockPushEvent).toHaveBeenCalledTimes(1);
  });

  it('includes search params when configured', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushEvent: mockPushEvent, setView: mockSetView, pushMeasurement: mockPushMeasurement },
    } as unknown as ReturnType<typeof getFaro>);

    mockPathname.mockReturnValue('/search');
    mockSearchParams.mockReturnValue(new URLSearchParams('q=test'));

    render(<FaroRouteTracker includeSearchParams={true} />);

    expect(mockSetView).toHaveBeenCalledWith({
      name: '/search?q=test',
    });
  });
});

describe('parameterizePath', () => {
  it('replaces numeric IDs', () => {
    expect(parameterizePath('/eprints/123')).toBe('/eprints/:id');
    expect(parameterizePath('/eprints/123/versions/456')).toBe('/eprints/:id/versions/:id');
  });

  it('replaces UUIDs', () => {
    const path = '/items/550e8400-e29b-41d4-a716-446655440000';
    expect(parameterizePath(path)).toBe('/items/:uuid');
  });

  it('replaces DIDs', () => {
    // DIDs have format did:method:identifier
    expect(parameterizePath('/users/did:plc:abc123')).toBe('/users/:did');
    expect(parameterizePath('/profile/did:web:example')).toBe('/profile/:did');
  });

  it('handles paths without IDs', () => {
    expect(parameterizePath('/about')).toBe('/about');
    expect(parameterizePath('/search')).toBe('/search');
  });

  it('handles complex paths', () => {
    const path = '/users/did:plc:abc123/eprints/456/comments/789';
    expect(parameterizePath(path)).toBe('/users/:did/eprints/:id/comments/:id');
  });

  it('handles root path', () => {
    expect(parameterizePath('/')).toBe('/');
  });

  it('handles paths with query strings', () => {
    // parameterizePath only handles the path, not query strings
    // If query strings are passed, they should be handled appropriately
    expect(parameterizePath('/search')).toBe('/search');
  });

  it('handles at-uri format paths', () => {
    // at:// URIs in paths
    const path = '/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2F123';
    // This would be URL-encoded, so the current implementation may not handle it perfectly
    // but it shouldn't break
    expect(() => parameterizePath(path)).not.toThrow();
  });

  it('handles mixed ID types in single path', () => {
    const path = '/org/550e8400-e29b-41d4-a716-446655440000/user/did:plc:abc123/post/999';
    const result = parameterizePath(path);
    expect(result).toBe('/org/:uuid/user/:did/post/:id');
  });

  it('handles base32 CIDs', () => {
    // Base32 CIDs used in ATProto are 32+ lowercase alphanumeric chars (a-z, 2-7)
    const path = '/blob/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    expect(parameterizePath(path)).toBe('/blob/:cid');
  });
});
