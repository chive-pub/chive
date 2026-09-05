'use client';

/**
 * One card shape for every link on an eprint page.
 *
 * @remarks
 * A paper's links were rendered four different ways depending on which tab
 * they landed on. The repository panel had a tinted icon and a platform badge;
 * the external identifiers panel had a flat row with a monospaced value;
 * backlinks had a small grey icon and a line of context; the GitHub integration
 * card had a title, a description, and a row of statistics. The last of those
 * was the one worth keeping, and the difference between them was not carrying
 * any meaning -- a reader cannot learn anything from the fact that a DOI is
 * styled unlike a repository.
 *
 * So all of them render through this. The card is deliberately uniform and
 * deliberately roomy: an icon that identifies the service, a title, a badge
 * naming the service, a subtitle carrying the part of the address a reader
 * would actually read, a description, a row of small facts, and the ways in.
 * Every field but the icon and the title is optional, so a card with nothing
 * but a DOI is the same card as one with stars, forks, and a licence.
 *
 * @packageDocumentation
 */

import { ExternalLink } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** A small labelled fact shown in the card's footer row. */
export interface ResourceStat {
  /** Optional leading icon. */
  readonly icon?: ComponentType<{ className?: string }>;
  /** The fact itself, already formatted. */
  readonly label: string;
  /** Screen-reader name, when the label alone would not say what it counts. */
  readonly title?: string;
}

/** A way into the resource. */
export interface ResourceAction {
  /** Link text. */
  readonly label: string;
  /** Where it goes. */
  readonly href: string;
  /**
   * Saves the target rather than opening it.
   *
   * @remarks
   * A supplementary file is fetched, not visited, and a download that opens a
   * new tab first leaves an empty one behind.
   */
  readonly download?: boolean;
  /** Leading icon, where one says what the action does faster than the words. */
  readonly icon?: ComponentType<{ className?: string }>;
}

/**
 * Props for {@link ResourceCard}.
 *
 * @public
 */
export interface ResourceCardProps {
  /** Service or resource icon. */
  readonly icon: ComponentType<{ className?: string }>;
  /** Tailwind text colour for the icon. */
  readonly iconColor?: string;
  /** Tailwind background for the icon tile. */
  readonly iconBg?: string;
  /** What this resource is called. */
  readonly title: string;
  /** The service it lives on, shown as a badge beside the title. */
  readonly badge?: string;
  /**
   * The address, or the part of it worth reading.
   *
   * @remarks
   * `owner/repo` for a repository, `host/path` for anything else on the web,
   * the AT-URI for a record. This is the field that turns a card headed
   * "GitHub" into one that says which repository it means.
   */
  readonly subtitle?: string;
  /** Renders the subtitle monospaced, for an identifier or a URI. */
  readonly subtitleMono?: boolean;
  /** A sentence or two about the resource. */
  readonly description?: string;
  /** Small facts: stars, a date, a record key. */
  readonly stats?: readonly ResourceStat[];
  /**
   * Short keywords the resource carries.
   *
   * @remarks
   * GitHub topics, GitLab topics, Zenodo keywords. Capped on render, because
   * a repository with forty topics would otherwise be the tallest card on the
   * page.
   */
  readonly tags?: readonly string[];
  /**
   * Makes the whole card a link.
   *
   * @remarks
   * Used when there is exactly one place to go. A card with `actions` renders
   * those instead, because a link inside a link is not a thing a browser can
   * represent.
   */
  readonly href?: string;
  /** Ways in, when there is more than one or the card is not itself a link. */
  readonly actions?: readonly ResourceAction[];
  /** Anything the card should carry below its own content. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * Renders one linked resource.
 *
 * @param props - Component props
 * @returns The card
 *
 * @public
 */
export function ResourceCard({
  icon: Icon,
  iconColor = 'text-muted-foreground',
  iconBg = 'bg-muted',
  title,
  badge,
  subtitle,
  subtitleMono,
  description,
  stats,
  tags,
  href,
  actions,
  children,
  className,
}: ResourceCardProps) {
  const linkWraps = Boolean(href) && !actions?.length;

  const body = (
    <div className="flex items-start gap-3">
      <div className={cn('shrink-0 rounded-md p-2', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-words font-medium leading-tight">{title}</span>
          {badge && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {badge}
            </Badge>
          )}
        </div>

        {subtitle && (
          <p
            className={cn(
              'text-xs text-muted-foreground',
              // A URI has no spaces to wrap at, so it has to be allowed to
              // break anywhere or it pushes the card off a narrow screen.
              subtitleMono ? 'break-all font-mono' : 'break-words'
            )}
          >
            {subtitle}
          </p>
        )}

        {description && <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>}

        {stats && stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
            {stats.map((stat, index) => {
              const StatIcon = stat.icon;
              return (
                // Two stats can carry the same text -- an unreachable upstream
                // renders both counts as an em dash -- so the position is the
                // only key that stays unique.
                // eslint-disable-next-line react/no-array-index-key
                <span
                  key={`${stat.label}-${index}`}
                  className="flex items-center gap-1"
                  title={stat.title}
                >
                  {StatIcon && <StatIcon className="h-3.5 w-3.5" />}
                  {stat.label}
                </span>
              );
            })}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {tags.length > 5 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{tags.length - 5}
              </Badge>
            )}
          </div>
        )}

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            {actions.map((action) => {
              const ActionIcon = action.icon ?? ExternalLink;
              return (
                <a
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  {...(action.download
                    ? { download: true }
                    : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {action.label}
                  <ActionIcon className="h-3 w-3" />
                </a>
              );
            })}
          </div>
        )}

        {children}
      </div>

      {linkWraps && (
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  );

  const shell = cn('rounded-lg border bg-card p-3', className);

  if (linkWraps) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('group block transition-colors hover:bg-accent/50', shell)}
      >
        {body}
      </a>
    );
  }

  return <div className={shell}>{body}</div>;
}
