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

export const runtime = 'edge';

// Image dimensions for OG images (standard size for Bluesky)
const WIDTH = 1200;
const HEIGHT = 630;

// Colors matching Chive design system
const COLORS = {
  background: '#f8fafc', // slate-50
  backgroundGradient: '#f1f5f9', // slate-100
  primary: '#0f172a', // slate-900
  secondary: '#475569', // slate-600
  muted: '#94a3b8', // slate-400
  accent: '#10b981', // emerald-500
  border: '#e2e8f0', // slate-200
};

/**
 * GET handler for OG image generation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') as 'eprint' | 'author' | 'review' | 'endorsement' | null;

  if (!type) {
    return new Response('Missing type parameter', { status: 400 });
  }

  try {
    switch (type) {
      case 'eprint':
        return await generateEprintImage(searchParams);
      case 'author':
        return await generateAuthorImage(searchParams);
      case 'review':
        return await generateReviewImage(searchParams);
      case 'endorsement':
        return await generateEndorsementImage(searchParams);
      default:
        return new Response(`Unknown type: ${type}`, { status: 400 });
    }
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

/**
 * Generate OG image for an eprint.
 */
async function generateEprintImage(params: URLSearchParams): Promise<ImageResponse> {
  const title = params.get('title') || 'Untitled Eprint';
  const author = params.get('author') || 'Unknown Author';
  const handle = params.get('handle') || '';
  const affiliation = params.get('affiliation') || '';
  const fields = params.get('fields')?.split(',').filter(Boolean) || [];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundGradient} 100%)`,
      }}
    >
      {/* Header with logo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <span style={{ fontSize: '28px', marginRight: '12px' }}>🌿</span>
        <span
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: COLORS.accent,
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
                background: COLORS.accent + '20',
                color: COLORS.accent,
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
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for an author profile.
 */
async function generateAuthorImage(params: URLSearchParams): Promise<ImageResponse> {
  const name = params.get('name') || 'Unknown Author';
  const handle = params.get('handle') || '';
  const affiliation = params.get('affiliation') || '';
  const bio = params.get('bio') || '';
  const avatar = params.get('avatar');
  const eprintCount = params.get('eprints') || '0';
  const endorsementCount = params.get('endorsements') || '0';
  const reviewCount = params.get('reviews') || '0';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundGradient} 100%)`,
      }}
    >
      {/* Header with logo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <span style={{ fontSize: '28px', marginRight: '12px' }}>🌿</span>
        <span
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: COLORS.accent,
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
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for a review.
 */
async function generateReviewImage(params: URLSearchParams): Promise<ImageResponse> {
  const content = params.get('content') || '';
  const reviewer = params.get('reviewer') || 'Anonymous';
  const reviewerHandle = params.get('reviewerHandle') || '';
  const eprintTitle = params.get('eprintTitle') || 'Eprint';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundGradient} 100%)`,
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
          <span style={{ fontSize: '28px', marginRight: '12px' }}>🌿</span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: COLORS.accent,
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
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}

/**
 * Generate OG image for an endorsement.
 */
async function generateEndorsementImage(params: URLSearchParams): Promise<ImageResponse> {
  const contributions = params.get('contributions')?.split(',').filter(Boolean) || [];
  const comment = params.get('comment') || '';
  const endorser = params.get('endorser') || 'Anonymous';
  const endorserHandle = params.get('endorserHandle') || '';
  const eprintTitle = params.get('eprintTitle') || 'Eprint';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundGradient} 100%)`,
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
          <span style={{ fontSize: '28px', marginRight: '12px' }}>🌿</span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: COLORS.accent,
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
            background: COLORS.accent + '20',
            color: COLORS.accent,
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
                background: COLORS.accent + '20',
                color: COLORS.accent,
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
