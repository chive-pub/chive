'use client';

/**
 * Shows a researcher's sifa.id profile alongside their Chive profile.
 *
 * @remarks
 * sifa.id is an ATProto professional profile service whose records live in each
 * researcher's own repository, so Chive reads their positions and education
 * from the same place it reads their eprints. A researcher who keeps their
 * employment history there does not have to retype it here.
 *
 * The panel is deliberately a view of their sifa data rather than a silent
 * merge into the Chive profile: the two are separate records with separate
 * owners, and a reader should be able to see which service said what. The
 * import affordance in profile settings is where a researcher chooses to copy
 * it across.
 *
 * @packageDocumentation
 */

import { Briefcase, GraduationCap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SifaProfile, SifaRole } from '@/lib/api/generated/types/pub/chive/author/getProfile';

/**
 * Props for {@link SifaPanel}.
 *
 * @public
 */
export interface SifaPanelProps {
  /** The researcher's sifa profile, as returned by `pub.chive.author.getProfile` */
  sifa: SifaProfile;
  /** Additional class names */
  className?: string;
}

/**
 * Formats the span a role covers.
 *
 * @remarks
 * sifa dates are ISO strings; only the year is worth showing beside a job
 * title, and a role with no start date shows nothing rather than "undefined".
 */
function formatSpan(role: SifaRole): string | null {
  const from = role.startedAt?.slice(0, 4);
  const to = role.endedAt?.slice(0, 4);

  if (from && to) return `${from}–${to}`;
  if (from) return `${from}–present`;
  if (to) return `until ${to}`;
  return null;
}

/**
 * Renders one role.
 */
function Role({ role }: { role: SifaRole }) {
  const span = formatSpan(role);

  return (
    <li className="flex items-start gap-2">
      {role.source === 'education' ? (
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{role.institution}</span>
          {role.isPrimary === true && (
            <Badge variant="outline" className="text-xs font-normal">
              Primary
            </Badge>
          )}
        </div>
        {(role.title ?? span) && (
          <p className="text-sm text-muted-foreground">
            {[role.title, span].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Displays the sifa.id profile for a researcher.
 *
 * @param props - Component props
 * @returns The panel, or nothing when there is no sifa profile
 *
 * @public
 */
export function SifaPanel({ sifa, className }: SifaPanelProps) {
  const current = sifa.currentRoles ?? [];
  const previous = sifa.previousRoles ?? [];

  if (!sifa.hasProfile || (current.length === 0 && previous.length === 0 && !sifa.headline)) {
    return null;
  }

  return (
    <section
      className={cn('space-y-4 rounded-lg border p-4', className)}
      aria-labelledby="sifa-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sifa-heading" className="text-sm font-medium">
          Professional profile
        </h2>
        <span className="text-xs text-muted-foreground">
          from{' '}
          <a
            href="https://sifa.id"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            sifa.id
          </a>
        </span>
      </div>

      {sifa.headline && <p className="text-sm">{sifa.headline}</p>}

      {current.length > 0 && (
        <ul className="space-y-2">
          {current.map((role, i) => (
            <Role key={`current-${String(i)}`} role={role} />
          ))}
        </ul>
      )}

      {previous.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Previously
          </h3>
          <ul className="space-y-2">
            {previous.map((role, i) => (
              <Role key={`previous-${String(i)}`} role={role} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
