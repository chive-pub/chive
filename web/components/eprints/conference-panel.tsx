'use client';

/**
 * Conference presentation panel for eprint pages.
 *
 * @remarks
 * Displays conference presentation details including venue name,
 * presentation type, location, date, and links.
 *
 * @packageDocumentation
 */

import { CalendarDays, ExternalLink, MapPin, Presentation } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConferencePresentation } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface ConferencePanelProps {
  /** Conference presentation data */
  conferencePresentation?: ConferencePresentation;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats a presentation date string for display.
 */
function formatPresentationDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Conference presentation panel component.
 *
 * Displays a single card with conference venue, presentation type,
 * location, date, and relevant links.
 *
 * @param props - Component props
 * @returns Conference panel element, or null when data is missing
 */
export function ConferencePanel({ conferencePresentation, className }: ConferencePanelProps) {
  if (!conferencePresentation) {
    return null;
  }

  const { conferenceName, conferenceAcronym } = conferencePresentation;

  // Return null if there is no name or acronym to display
  if (!conferenceName && !conferenceAcronym) {
    return null;
  }

  const presentationType = conferencePresentation.presentationTypeSlug ?? undefined;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Presentation className="h-4 w-4" />
          Conference Presentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Conference name and acronym */}
        <div>
          <p className="font-semibold text-base leading-snug">
            {conferenceName}
            {conferenceAcronym && conferenceName && (
              <span className="text-muted-foreground font-normal"> ({conferenceAcronym})</span>
            )}
            {conferenceAcronym && !conferenceName && conferenceAcronym}
          </p>
          {conferencePresentation.conferenceIteration && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {conferencePresentation.conferenceIteration}
            </p>
          )}
        </div>

        {/* Presentation type badge */}
        {presentationType && (
          <div>
            <Badge variant="secondary">{capitalize(presentationType)}</Badge>
          </div>
        )}

        {/* Location */}
        {conferencePresentation.conferenceLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-h-[44px] sm:min-h-0">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{conferencePresentation.conferenceLocation}</span>
          </div>
        )}

        {/* Date */}
        {conferencePresentation.presentationDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-h-[44px] sm:min-h-0">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>{formatPresentationDate(conferencePresentation.presentationDate)}</span>
          </div>
        )}

        {/* Links */}
        <div className="space-y-2">
          {conferencePresentation.conferenceUrl && (
            <a
              href={conferencePresentation.conferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              Visit conference website
            </a>
          )}
          {conferencePresentation.proceedingsDoi && (
            <a
              href={`https://doi.org/${conferencePresentation.proceedingsDoi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono truncate">
                DOI: {conferencePresentation.proceedingsDoi}
              </span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
