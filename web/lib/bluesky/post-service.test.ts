import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBlueskyPost,
  fetchOgImageBlob,
  countGraphemes,
  validatePostLength,
  buildBlueskyPostUrl,
} from './post-service';
import type { Agent } from '@atproto/api';

// Mock the RichText class
vi.mock('@atproto/api', async () => {
  const actual = await vi.importActual<typeof import('@atproto/api')>('@atproto/api');

  class MockRichText {
    text: string;
    facets: unknown[];

    constructor({ text }: { text: string }) {
      this.text = text;
      this.facets = [];
    }

    async detectFacets() {
      // No-op for tests
    }
  }

  return {
    ...actual,
    RichText: MockRichText,
  };
});

describe('countGraphemes', () => {
  it('counts ASCII characters correctly', () => {
    expect(countGraphemes('Hello')).toBe(5);
    expect(countGraphemes('Hello World')).toBe(11);
  });

  it('counts simple emojis as single graphemes', () => {
    expect(countGraphemes('\u{1F44B}')).toBe(1); // Wave emoji
    expect(countGraphemes('Hi \u{1F44B}')).toBe(4); // "Hi " + wave
  });

  it('counts emoji with skin tone modifier as single grapheme', () => {
    expect(countGraphemes('\u{1F44B}\u{1F3FD}')).toBe(1); // Wave + medium skin tone
  });

  it('counts ZWJ emoji sequences as single grapheme', () => {
    // Family: man + ZWJ + woman + ZWJ + girl + ZWJ + girl
    expect(countGraphemes('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}')).toBe(1);
  });

  it('counts flag emojis as single grapheme', () => {
    // US flag
    expect(countGraphemes('\u{1F1FA}\u{1F1F8}')).toBe(1);
  });

  it('counts accented characters correctly', () => {
    // Combining character: e + combining acute accent
    expect(countGraphemes('cafe\u0301')).toBe(4);
    // Precomposed: é
    expect(countGraphemes('caf\u00E9')).toBe(4);
  });

  it('counts CJK characters correctly', () => {
    expect(countGraphemes('\u4F60\u597D')).toBe(2); // 你好
  });

  it('handles empty string', () => {
    expect(countGraphemes('')).toBe(0);
  });

  it('handles mixed content', () => {
    // "Hi! " + flag + wave = 5 graphemes
    expect(countGraphemes('Hi! \u{1F1FA}\u{1F1F8}\u{1F44B}')).toBe(6);
  });
});

describe('validatePostLength', () => {
  it('returns valid for text under limit', () => {
    const result = validatePostLength('Hello');
    expect(result.isValid).toBe(true);
    expect(result.count).toBe(5);
  });

  it('returns valid for text at limit', () => {
    const result = validatePostLength('a'.repeat(300));
    expect(result.isValid).toBe(true);
    expect(result.count).toBe(300);
  });

  it('returns invalid for text over limit', () => {
    const result = validatePostLength('a'.repeat(301));
    expect(result.isValid).toBe(false);
    expect(result.count).toBe(301);
  });

  it('counts emojis correctly', () => {
    // 299 'a' + 1 family emoji = 300
    const result = validatePostLength(
      'a'.repeat(299) + '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}'
    );
    expect(result.isValid).toBe(true);
    expect(result.count).toBe(300);
  });
});

describe('buildBlueskyPostUrl', () => {
  it('builds correct post URL', () => {
    const url = buildBlueskyPostUrl('did:plc:abc123', 'xyz789');
    expect(url).toBe('https://bsky.app/profile/did:plc:abc123/post/xyz789');
  });
});

describe('fetchOgImageBlob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns image bytes', async () => {
    const mockBytes = new Uint8Array([1, 2, 3, 4]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockBytes.buffer),
    });

    const result = await fetchOgImageBlob('https://example.com/image.png');
    expect(result).toEqual(mockBytes);
  });

  it('throws on fetch error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchOgImageBlob('https://example.com/image.png')).rejects.toThrow(
      'Failed to fetch OG image: 404 Not Found'
    );
  });

  it('throws if image exceeds 1MB', async () => {
    const largeBytes = new Uint8Array(1_000_001);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(largeBytes.buffer),
    });

    await expect(fetchOgImageBlob('https://example.com/large.png')).rejects.toThrow(
      /exceeds 1MB limit/
    );
  });
});

describe('createBlueskyPost', () => {
  const mockAgent = {
    did: 'did:plc:test123',
    uploadBlob: vi.fn(),
    com: {
      atproto: {
        repo: {
          createRecord: vi.fn(),
        },
      },
    },
  } as unknown as Agent;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockAgent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafytest',
      },
    });
  });

  it('creates a post without thumbnail', async () => {
    const result = await createBlueskyPost(mockAgent, {
      text: 'Hello world!',
      embed: {
        uri: 'https://example.com',
        title: 'Example',
        description: 'Description',
      },
    });

    expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.post/abc123');
    expect(result.cid).toBe('bafytest');
    expect(result.rkey).toBe('abc123');

    expect(mockAgent.uploadBlob).not.toHaveBeenCalled();
    expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
      repo: 'did:plc:test123',
      collection: 'app.bsky.feed.post',
      record: expect.objectContaining({
        $type: 'app.bsky.feed.post',
        text: 'Hello world!',
        embed: expect.objectContaining({
          $type: 'app.bsky.embed.external',
          external: expect.objectContaining({
            uri: 'https://example.com',
            title: 'Example',
            description: 'Description',
          }),
        }),
      }),
    });
  });

  it('uploads thumbnail and includes in post', async () => {
    const mockBlobRef = { $link: 'bafythumb' };
    (mockAgent.uploadBlob as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { blob: mockBlobRef },
    });

    const thumbBlob = new Uint8Array([1, 2, 3]);

    await createBlueskyPost(mockAgent, {
      text: 'Check this out!',
      embed: {
        uri: 'https://example.com',
        title: 'Example',
        description: 'Description',
        thumbBlob,
      },
    });

    expect(mockAgent.uploadBlob).toHaveBeenCalledWith(thumbBlob, { encoding: 'image/png' });
    expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          embed: expect.objectContaining({
            external: expect.objectContaining({
              thumb: mockBlobRef,
            }),
          }),
        }),
      })
    );
  });

  it('throws if thumbnail exceeds 1MB', async () => {
    const largeThumb = new Uint8Array(1_000_001);

    await expect(
      createBlueskyPost(mockAgent, {
        text: 'Test',
        embed: {
          uri: 'https://example.com',
          title: 'Example',
          description: 'Description',
          thumbBlob: largeThumb,
        },
      })
    ).rejects.toThrow(/exceeds 1MB limit/);
  });

  it('throws if agent is not authenticated', async () => {
    const unauthAgent = { did: undefined } as unknown as Agent;

    await expect(
      createBlueskyPost(unauthAgent, {
        text: 'Test',
        embed: {
          uri: 'https://example.com',
          title: 'Example',
          description: 'Description',
        },
      })
    ).rejects.toThrow('Agent is not authenticated');
  });

  it('handles rate limit error', async () => {
    (mockAgent.com.atproto.repo.createRecord as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 429,
      headers: { 'retry-after': '30' },
    });

    await expect(
      createBlueskyPost(mockAgent, {
        text: 'Test',
        embed: {
          uri: 'https://example.com',
          title: 'Example',
          description: 'Description',
        },
      })
    ).rejects.toThrow(/Rate limited.*30 seconds/);
  });
});
