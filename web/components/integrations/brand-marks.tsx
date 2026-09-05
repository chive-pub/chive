'use client';

/**
 * Brand marks for the services an eprint links out to.
 *
 * @remarks
 * Kept as icon components with the same shape as a Lucide icon, so a service's
 * own mark can be passed anywhere the shared card takes an icon. A recognized
 * mark is the fastest thing on a card to read, and the difference between a
 * generic code glyph and GitHub's is the difference between a card a reader
 * scans and one they have to parse.
 *
 * @packageDocumentation
 */

/**
 * The GitHub mark.
 *
 * @param props - Standard icon props
 * @returns The mark
 *
 * @public
 */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * The GitLab mark.
 *
 * @param props - Standard icon props
 * @returns The mark
 *
 * @public
 */
export function GitlabMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="#E24329" d="M16 31.2L21.2 16H10.8L16 31.2z" />
      <path fill="#FC6D26" d="M16 31.2L10.8 16H2L16 31.2z" />
      <path fill="#FCA326" d="M2 16L.1 21.8c-.2.5 0 1.1.5 1.4L16 31.2L2 16z" />
      <path fill="#E24329" d="M2 16h8.8L7.5 5.4c-.1-.4-.7-.4-.9 0L2 16z" />
      <path fill="#FC6D26" d="M16 31.2L21.2 16H30L16 31.2z" />
      <path fill="#FCA326" d="M30 16l1.9 5.8c.2.5 0 1.1-.5 1.4L16 31.2L30 16z" />
      <path fill="#E24329" d="M30 16h-8.8l3.3-10.6c.1-.4.7-.4.9 0L30 16z" />
    </svg>
  );
}
