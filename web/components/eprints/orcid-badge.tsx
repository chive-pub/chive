import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Props for the OrcidBadge component.
 */
export interface OrcidBadgeProps {
  /** ORCID identifier (with or without URL prefix) */
  orcid: string;
  /** Whether to show the full ORCID URL */
  showFull?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an ORCID identifier as a clickable badge.
 *
 * @remarks
 * Server component that renders an ORCID with the official logo
 * and links to the ORCID profile page.
 *
 * @example
 * ```tsx
 * <OrcidBadge orcid="0000-0002-1825-0097" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the ORCID badge
 */
export function OrcidBadge({
  orcid,
  showFull = false,
  size = 'default',
  className,
}: OrcidBadgeProps) {
  const cleanOrcid = normalizeOrcid(orcid);
  const orcidUrl = `https://orcid.org/${cleanOrcid}`;

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <a
      href={orcidUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[#a6ce39]/10 px-2.5 py-1 hover:bg-[#a6ce39]/20',
        textSize,
        className
      )}
      title={`ORCID: ${cleanOrcid}`}
    >
      <OrcidIcon className={iconSize} />
      <span className="font-mono">{showFull ? orcidUrl : cleanOrcid}</span>
      <ExternalLink className={cn(iconSize, 'text-muted-foreground')} />
    </a>
  );
}

/**
 * Props for the OrcidLink component.
 */
export interface OrcidLinkProps {
  /** ORCID identifier */
  orcid: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Simple ORCID link without badge styling.
 *
 * @example
 * ```tsx
 * <OrcidLink orcid="0000-0002-1825-0097" />
 * ```
 */
export function OrcidLink({ orcid, className }: OrcidLinkProps) {
  const cleanOrcid = normalizeOrcid(orcid);
  const orcidUrl = `https://orcid.org/${cleanOrcid}`;

  return (
    <a
      href={orcidUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-sm hover:underline', className)}
    >
      <OrcidIcon className="h-4 w-4" />
      <span className="font-mono">{cleanOrcid}</span>
    </a>
  );
}

/**
 * ORCID logo icon component.
 */
function OrcidIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M128 256C198.692 256 256 198.692 256 128C256 57.3076 198.692 0 128 0C57.3076 0 0 57.3076 0 128C0 198.692 57.3076 256 128 256Z"
        fill="#A6CE39"
      />
      <path d="M86.3077 186.154H70.1538V69.8462H86.3077V186.154Z" fill="white" />
      <path
        d="M78.2308 58.1538C73.0769 58.1538 68.9231 54 68.9231 48.8462C68.9231 43.6923 73.0769 39.5385 78.2308 39.5385C83.3846 39.5385 87.5385 43.6923 87.5385 48.8462C87.5385 54 83.3846 58.1538 78.2308 58.1538Z"
        fill="white"
      />
      <path
        d="M108.308 69.8462H152.615C177.231 69.8462 193.385 85.2308 193.385 109.846C193.385 134.462 177.231 150.615 152.615 150.615H124.462V186.154H108.308V69.8462ZM151.385 136.923C168.308 136.923 177.231 127.231 177.231 110.615C177.231 94 168.308 84.3077 151.385 84.3077H124.462V136.923H151.385Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Normalizes an ORCID identifier to the standard format.
 */
function normalizeOrcid(orcid: string): string {
  // Remove URL prefix if present
  const cleaned = orcid.replace(/^https?:\/\/orcid\.org\//, '');

  // Validate format (0000-0000-0000-0000 or 0000-0000-0000-000X)
  const pattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
  if (pattern.test(cleaned)) {
    return cleaned;
  }

  // Try to format if just digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length === 16 || (digitsOnly.length === 15 && cleaned.endsWith('X'))) {
    const lastChar = cleaned.endsWith('X') ? 'X' : digitsOnly[15];
    const digits = digitsOnly.slice(0, 15);
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12)}${lastChar}`;
  }

  // Return as-is if can't parse
  return cleaned;
}

/**
 * Validates an ORCID identifier.
 *
 * @param orcid - The ORCID to validate
 * @returns True if the ORCID is valid
 */
export function isValidOrcid(orcid: string): boolean {
  const normalized = normalizeOrcid(orcid);
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalized);
}
