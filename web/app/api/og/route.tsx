/**
 * Dynamic Open Graph image generation for Bluesky social cards.
 *
 * @remarks
 * Generates 1200x630 PNG images for eprints, authors, reviews, and endorsements.
 * Used both for og:image meta tags and for Bluesky external embed thumbnails.
 *
 * @example
 * GET /api/og?type=eprint&uri=at://did:plc:abc/pub.chive.eprint.submission/123
 * GET /api/og?type=author&did=did:plc:abc123
 * GET /api/og?type=review&uri=at://did:plc:abc/pub.chive.review.comment/456
 * GET /api/og?type=endorsement&uri=at://did:plc:abc/pub.chive.review.endorsement/789
 */

import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/observability';

export const runtime = 'edge';

// Image dimensions for OG images (standard size for Bluesky)
const WIDTH = 1200;
const HEIGHT = 630;

// Colors matching Chive brand (from landing.html)
const COLORS = {
  // Brand colors
  brand: '#157200', // Primary Chive green
  brandLight: '#4ade80', // Secondary/accent green
  // Neutral colors
  background: '#fafafa', // Light background
  primary: '#171717', // Dark text
  secondary: '#737373', // Muted text
  muted: '#a3a3a3', // Light muted
  border: '#e5e5e5', // Borders
  white: '#ffffff',
};

// Chive logo URL - falls back to production URL if not available
const LOGO_PATH = '/chive-logo.svg';

// Geist Sans font URL (Regular and Bold weights)
const GEIST_REGULAR_URL =
  'https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-Regular.ttf';
const GEIST_BOLD_URL =
  'https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-Bold.ttf';

// Cache font data at module level for reuse
let geistRegularData: ArrayBuffer | null = null;
let geistBoldData: ArrayBuffer | null = null;

/**
 * Load Geist Sans fonts for OG image rendering.
 */
async function loadFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }>
> {
  // Load fonts if not cached
  if (!geistRegularData || !geistBoldData) {
    const [regularRes, boldRes] = await Promise.all([
      fetch(GEIST_REGULAR_URL),
      fetch(GEIST_BOLD_URL),
    ]);
    geistRegularData = await regularRes.arrayBuffer();
    geistBoldData = await boldRes.arrayBuffer();
  }

  return [
    { name: 'Geist', data: geistRegularData, weight: 400, style: 'normal' },
    { name: 'Geist', data: geistBoldData, weight: 700, style: 'normal' },
  ];
}

/**
 * GET handler for OG image generation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') as
    | 'default'
    | 'eprint'
    | 'author'
    | 'review'
    | 'endorsement'
    | null;

  // Default to 'default' type for homepage/site-wide OG image
  const imageType = type || 'default';

  // Build logo URL from request origin for dev/staging/prod compatibility
  const origin = request.nextUrl.origin;
  const logoUrl = `${origin}${LOGO_PATH}`;

  try {
    switch (imageType) {
      case 'default':
        return await generateDefaultImage(logoUrl);
      case 'eprint':
        return await generateEprintImage(searchParams, logoUrl);
      case 'author':
        return await generateAuthorImage(searchParams, logoUrl);
      case 'review':
        return await generateReviewImage(searchParams, logoUrl);
      case 'endorsement':
        return await generateEndorsementImage(searchParams, logoUrl);
      default:
        return new Response(`Unknown type: ${imageType}`, { status: 400 });
    }
  } catch (error) {
    logger.error('OG image generation error', error as Error, {
      component: 'og-route',
      type: imageType,
    });
    return new Response('Failed to generate image', { status: 500 });
  }
}

/**
 * Generate default OG image for the site homepage.
 *
 * Design principles (based on 2025-2026 best practices):
 * - Centered layout to prevent cropping issues on different platforms
 * - Minimal, clean design with plenty of white space
 * - Logo prominently displayed and readable at small thumbnail sizes
 * - Simple color scheme with brand green accent
 * - Works at 1.91:1 aspect ratio (1200x630) for Bluesky/Twitter/LinkedIn
 */
async function generateDefaultImage(logoUrl: string): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.white,
        fontFamily: 'Geist, Helvetica, Arial, sans-serif',
        padding: '60px',
      }}
    >
      {/* Centered logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Chive" width={140} height={140} style={{ borderRadius: '24px' }} />
      </div>

      {/* Brand name */}
      <div
        style={{
          fontSize: '80px',
          fontWeight: 700,
          color: COLORS.primary,
          letterSpacing: '-0.03em',
          marginBottom: '16px',
        }}
      >
        Chive
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '28px',
          color: COLORS.secondary,
          textAlign: 'center',
          maxWidth: '800px',
        }}
      >
        Decentralized eprints on ATProto
      </div>

      {/* URL */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: '40px',
          padding: '12px 24px',
          background: COLORS.brand + '12',
          borderRadius: '100px',
        }}
      >
        <span
          style={{
            fontSize: '22px',
            color: COLORS.brand,
            fontWeight: 600,
          }}
        >
          chive.pub
        </span>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for an eprint.
 */
async function generateEprintImage(
  params: URLSearchParams,
  logoUrl: string
): Promise<ImageResponse> {
  const title = params.get('title') || 'Untitled Eprint';
  const author = params.get('author') || 'Unknown Author';
  const handle = params.get('handle') || '';
  const affiliation = params.get('affiliation') || '';
  const fields = params.get('fields')?.split(',').filter(Boolean) || [];
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: COLORS.background,
        fontFamily: 'Geist, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header with logo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Chive" width={40} height={40} style={{ marginRight: '12px' }} />
        <span
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: COLORS.brand,
            letterSpacing: '0.1em',
          }}
        >
          CHIVE
        </span>
      </div>

      {/* Title container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: '48px',
            fontWeight: 700,
            color: COLORS.primary,
            lineHeight: 1.2,
            marginBottom: '24px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: '120px',
          }}
        >
          {truncateText(title, 100)}
        </div>

        {/* Author info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px', color: COLORS.secondary }}>
              {author}
              {handle && <span style={{ color: COLORS.muted, marginLeft: '8px' }}>@{handle}</span>}
            </span>
          </div>
          {affiliation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: COLORS.muted }}>{affiliation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Field badges */}
      {fields.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          {fields.slice(0, 3).map((field, i) => (
            <div
              key={i}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                background: COLORS.brand + '20',
                color: COLORS.brand,
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              {field}
            </div>
          ))}
        </div>
      )}
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for an author profile.
 */
async function generateAuthorImage(
  params: URLSearchParams,
  logoUrl: string
): Promise<ImageResponse> {
  const name = params.get('name') || 'Unknown Author';
  const handle = params.get('handle') || '';
  const affiliation = params.get('affiliation') || '';
  const bio = params.get('bio') || '';
  const avatar = params.get('avatar');
  const eprintCount = params.get('eprints') || '0';
  const endorsementCount = params.get('endorsements') || '0';
  const reviewCount = params.get('reviews') || '0';
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: COLORS.background,
        fontFamily: 'Geist, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header with logo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" width={32} height={32} style={{ marginRight: '12px' }} />
        <span
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: COLORS.brand,
            letterSpacing: '0.1em',
          }}
        >
          CHIVE
        </span>
      </div>

      {/* Profile section */}
      <div style={{ display: 'flex', gap: '32px', flex: 1 }}>
        {/* Avatar */}
        <div
          style={{
            width: '128px',
            height: '128px',
            borderRadius: '64px',
            background: COLORS.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            color: COLORS.muted,
            overflow: 'hidden',
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            getInitials(name)
          )}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              fontSize: '40px',
              fontWeight: 700,
              color: COLORS.primary,
              marginBottom: '8px',
            }}
          >
            {name}
          </div>
          {handle && (
            <div style={{ fontSize: '20px', color: COLORS.muted, marginBottom: '8px' }}>
              @{handle}
            </div>
          )}
          {affiliation && (
            <div style={{ fontSize: '18px', color: COLORS.secondary, marginBottom: '16px' }}>
              {affiliation}
            </div>
          )}
          {bio && (
            <div
              style={{
                fontSize: '18px',
                color: COLORS.secondary,
                lineHeight: 1.4,
                fontStyle: 'italic',
                maxHeight: '80px',
                overflow: 'hidden',
              }}
            >
              &ldquo;{truncateText(bio, 150)}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '32px', marginTop: '24px' }}>
        <Stat label="eprints" value={eprintCount} />
        <Stat label="endorsements" value={endorsementCount} />
        <Stat label="reviews" value={reviewCount} />
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for a review.
 */
async function generateReviewImage(
  params: URLSearchParams,
  logoUrl: string
): Promise<ImageResponse> {
  const content = params.get('content') || '';
  const reviewer = params.get('reviewer') || 'Anonymous';
  const reviewerHandle = params.get('reviewerHandle') || '';
  const eprintTitle = params.get('eprintTitle') || 'Eprint';
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: COLORS.background,
        fontFamily: 'Geist, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={32} height={32} style={{ marginRight: '12px' }} />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: COLORS.brand,
              letterSpacing: '0.1em',
            }}
          >
            CHIVE
          </span>
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#3b82f6' + '20',
            color: '#3b82f6',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          REVIEW
        </div>
      </div>

      {/* Review content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            color: COLORS.secondary,
            lineHeight: 1.5,
            fontStyle: 'italic',
            marginBottom: '24px',
            maxHeight: '180px',
            overflow: 'hidden',
          }}
        >
          &ldquo;{truncateText(content, 200)}&rdquo;
        </div>

        {/* Reviewer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', color: COLORS.primary }}>— {reviewer}</span>
          {reviewerHandle && (
            <span style={{ fontSize: '18px', color: COLORS.muted }}>(@{reviewerHandle})</span>
          )}
        </div>
      </div>

      {/* Eprint reference */}
      <div
        style={{
          padding: '16px 24px',
          borderRadius: '12px',
          border: `1px solid ${COLORS.border}`,
          background: 'white',
          marginTop: '24px',
        }}
      >
        <div style={{ fontSize: '14px', color: COLORS.muted, marginBottom: '4px' }}>On:</div>
        <div style={{ fontSize: '18px', color: COLORS.primary, fontWeight: 600 }}>
          {truncateText(eprintTitle, 80)}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for an endorsement.
 */
async function generateEndorsementImage(
  params: URLSearchParams,
  logoUrl: string
): Promise<ImageResponse> {
  const contributions = params.get('contributions')?.split(',').filter(Boolean) || [];
  const comment = params.get('comment') || '';
  const endorser = params.get('endorser') || 'Anonymous';
  const endorserHandle = params.get('endorserHandle') || '';
  const eprintTitle = params.get('eprintTitle') || 'Eprint';
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: COLORS.background,
        fontFamily: 'Geist, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={32} height={32} style={{ marginRight: '12px' }} />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: COLORS.brand,
              letterSpacing: '0.1em',
            }}
          >
            CHIVE
          </span>
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: COLORS.brand + '20',
            color: COLORS.brand,
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          ENDORSEMENT
        </div>
      </div>

      {/* Endorsement content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Contribution badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span style={{ fontSize: '32px' }}>👍</span>
          <span style={{ fontSize: '20px', color: COLORS.secondary }}>Endorsed for:</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {contributions.slice(0, 4).map((contribution, i) => (
            <div
              key={i}
              style={{
                padding: '10px 20px',
                borderRadius: '24px',
                background: COLORS.brand + '20',
                color: COLORS.brand,
                fontSize: '18px',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {contribution.replace(/-/g, ' ')}
            </div>
          ))}
        </div>

        {/* Comment */}
        {comment && (
          <div
            style={{
              fontSize: '22px',
              color: COLORS.secondary,
              lineHeight: 1.4,
              fontStyle: 'italic',
              marginBottom: '24px',
              maxHeight: '80px',
              overflow: 'hidden',
            }}
          >
            &ldquo;{truncateText(comment, 150)}&rdquo;
          </div>
        )}

        {/* Endorser */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', color: COLORS.primary }}>— {endorser}</span>
          {endorserHandle && (
            <span style={{ fontSize: '18px', color: COLORS.muted }}>(@{endorserHandle})</span>
          )}
        </div>
      </div>

      {/* Eprint reference */}
      <div
        style={{
          padding: '16px 24px',
          borderRadius: '12px',
          border: `1px solid ${COLORS.border}`,
          background: 'white',
          marginTop: '24px',
        }}
      >
        <div style={{ fontSize: '18px', color: COLORS.primary, fontWeight: 600 }}>
          {truncateText(eprintTitle, 80)}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Stat display component.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ fontSize: '28px', fontWeight: 700, color: COLORS.primary }}>{value}</span>
      <span style={{ fontSize: '16px', color: COLORS.muted }}>{label}</span>
    </div>
  );
}

/**
 * Truncate text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get initials from a name.
 */
function getInitials(name: string): string {
  const parts = name.split(/[\s.-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
