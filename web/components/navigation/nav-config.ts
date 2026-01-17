/**
 * Navigation configuration for the main site navigation.
 *
 * @remarks
 * Follows industry-standard progressive disclosure pattern:
 * - "Discover" groups content browsing features (finding/consuming)
 * - "Community" groups participation features (contributing/governing)
 *
 * Modeled after GitHub Explore, Wikipedia portals, and Stack Overflow.
 *
 * @packageDocumentation
 */

import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Compass,
  Network,
  Users,
  TrendingUp,
  Tag,
  Vote,
  Info,
  MessageCircle,
} from 'lucide-react';

/**
 * A single navigation item (leaf node).
 */
export interface NavItem {
  /** Display label */
  label: string;
  /** Link href */
  href: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Short description for dropdown menus */
  description?: string;
}

/**
 * A navigation group with children (dropdown).
 */
export interface NavGroup {
  /** Display label for the trigger */
  label: string;
  /** Child navigation items */
  children: NavItem[];
}

/**
 * Union type for navigation entries.
 */
export type NavEntry = NavItem | NavGroup;

/**
 * Type guard for NavGroup.
 */
export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

/**
 * Main navigation items for desktop dropdown menus.
 *
 * @remarks
 * Two top-level groups reduce cognitive load while providing
 * access to all 9 main features.
 *
 * Design rationale:
 * - "Discover" = task of finding/reading content
 * - "Community" = task of participating/contributing
 * - "About" = standalone link for discoverability
 */
export const mainNavItems: NavEntry[] = [
  {
    label: 'Discover',
    children: [
      {
        label: 'Eprints',
        href: '/eprints',
        icon: FileText,
        description: 'Browse recent eprint submissions',
      },
      {
        label: 'Browse',
        href: '/browse',
        icon: Compass,
        description: 'Explore with faceted classification',
      },
      {
        label: 'Fields',
        href: '/fields',
        icon: Network,
        description: 'Knowledge graph field taxonomy',
      },
      {
        label: 'Authors',
        href: '/authors',
        icon: Users,
        description: 'Find researchers and their work',
      },
      {
        label: 'Trending',
        href: '/trending',
        icon: TrendingUp,
        description: 'Popular eprints this week',
      },
      {
        label: 'Tags',
        href: '/tags',
        icon: Tag,
        description: 'Community-contributed tags',
      },
    ],
  },
  {
    label: 'Community',
    children: [
      {
        label: 'Knowledge Graph',
        href: '/graph',
        icon: Network,
        description: 'Explore the unified knowledge graph',
      },
      {
        label: 'Governance',
        href: '/governance',
        icon: Vote,
        description: 'Proposals and community voting',
      },
      {
        label: 'Zulip',
        href: 'https://community.chive.pub',
        icon: MessageCircle,
        description: 'Join the discussion on Zulip',
      },
    ],
  },
  {
    label: 'About',
    href: '/about',
  },
];

/**
 * Flat list of all navigation items for mobile and search.
 */
export const allNavItems: NavItem[] = mainNavItems.flatMap((entry) =>
  isNavGroup(entry) ? entry.children : [entry]
);
