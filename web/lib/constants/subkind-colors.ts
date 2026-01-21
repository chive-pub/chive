/**
 * Subkind color configuration for knowledge graph node references.
 *
 * @remarks
 * Provides consistent colors for each subkind across:
 * - Annotation editor autocomplete
 * - Annotation body renderer chips
 * - Node search results
 *
 * Colors follow Tailwind's color palette with light/dark mode support.
 *
 * @packageDocumentation
 */

import type { LucideIcon } from 'lucide-react';
import {
  Layers,
  Tag,
  Award,
  FileType,
  Scale,
  Clock,
  Lightbulb,
  Building2,
  User,
  Calendar,
  Network,
  Sparkles,
  FileText,
  Server,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Color configuration for a subkind.
 */
export interface SubkindColorConfig {
  /** Tailwind classes for light mode background */
  bgLight: string;
  /** Tailwind classes for light mode text */
  textLight: string;
  /** Tailwind classes for dark mode background */
  bgDark: string;
  /** Tailwind classes for dark mode text */
  textDark: string;
  /** Tailwind classes for hover state (light) */
  hoverLight: string;
  /** Tailwind classes for hover state (dark) */
  hoverDark: string;
  /** Border color for editor chips */
  border: string;
}

// =============================================================================
// COLOR DEFINITIONS
// =============================================================================

/**
 * Subkind color configurations.
 *
 * @remarks
 * Type nodes (# trigger):
 * - field: Emerald - academic disciplines
 * - facet: Amber - classification facets
 * - contribution-type: Violet - CRediT roles
 * - document-format: Cyan - file formats
 * - license: Lime - licensing terms
 * - publication-status: Sky - lifecycle states
 * - paper-type: Indigo - document types
 * - motivation: Fuchsia - annotation motivations
 * - platform-*: Rose - external platforms
 * - supplementary-category: Teal - supplementary material types
 * - presentation-type: Slate - presentation formats
 *
 * Object nodes (@ trigger):
 * - institution: Blue - organizations
 * - person: Pink - individuals
 * - topic: Purple - subjects
 * - geographic: Green - locations
 * - event: Orange - conferences/events
 */
export const SUBKIND_COLORS: Record<string, SubkindColorConfig> = {
  // Type nodes (# trigger)
  field: {
    bgLight: 'bg-emerald-100',
    textLight: 'text-emerald-800',
    bgDark: 'dark:bg-emerald-900/30',
    textDark: 'dark:text-emerald-300',
    hoverLight: 'hover:bg-emerald-200',
    hoverDark: 'dark:hover:bg-emerald-800/40',
    border: 'border-emerald-200 dark:border-emerald-700',
  },
  facet: {
    bgLight: 'bg-amber-100',
    textLight: 'text-amber-800',
    bgDark: 'dark:bg-amber-900/30',
    textDark: 'dark:text-amber-300',
    hoverLight: 'hover:bg-amber-200',
    hoverDark: 'dark:hover:bg-amber-800/40',
    border: 'border-amber-200 dark:border-amber-700',
  },
  'contribution-type': {
    bgLight: 'bg-violet-100',
    textLight: 'text-violet-800',
    bgDark: 'dark:bg-violet-900/30',
    textDark: 'dark:text-violet-300',
    hoverLight: 'hover:bg-violet-200',
    hoverDark: 'dark:hover:bg-violet-800/40',
    border: 'border-violet-200 dark:border-violet-700',
  },
  'document-format': {
    bgLight: 'bg-cyan-100',
    textLight: 'text-cyan-800',
    bgDark: 'dark:bg-cyan-900/30',
    textDark: 'dark:text-cyan-300',
    hoverLight: 'hover:bg-cyan-200',
    hoverDark: 'dark:hover:bg-cyan-800/40',
    border: 'border-cyan-200 dark:border-cyan-700',
  },
  license: {
    bgLight: 'bg-lime-100',
    textLight: 'text-lime-800',
    bgDark: 'dark:bg-lime-900/30',
    textDark: 'dark:text-lime-300',
    hoverLight: 'hover:bg-lime-200',
    hoverDark: 'dark:hover:bg-lime-800/40',
    border: 'border-lime-200 dark:border-lime-700',
  },
  'publication-status': {
    bgLight: 'bg-sky-100',
    textLight: 'text-sky-800',
    bgDark: 'dark:bg-sky-900/30',
    textDark: 'dark:text-sky-300',
    hoverLight: 'hover:bg-sky-200',
    hoverDark: 'dark:hover:bg-sky-800/40',
    border: 'border-sky-200 dark:border-sky-700',
  },
  'paper-type': {
    bgLight: 'bg-indigo-100',
    textLight: 'text-indigo-800',
    bgDark: 'dark:bg-indigo-900/30',
    textDark: 'dark:text-indigo-300',
    hoverLight: 'hover:bg-indigo-200',
    hoverDark: 'dark:hover:bg-indigo-800/40',
    border: 'border-indigo-200 dark:border-indigo-700',
  },
  motivation: {
    bgLight: 'bg-fuchsia-100',
    textLight: 'text-fuchsia-800',
    bgDark: 'dark:bg-fuchsia-900/30',
    textDark: 'dark:text-fuchsia-300',
    hoverLight: 'hover:bg-fuchsia-200',
    hoverDark: 'dark:hover:bg-fuchsia-800/40',
    border: 'border-fuchsia-200 dark:border-fuchsia-700',
  },
  // Platform types (all use Rose)
  'platform-code': {
    bgLight: 'bg-rose-100',
    textLight: 'text-rose-800',
    bgDark: 'dark:bg-rose-900/30',
    textDark: 'dark:text-rose-300',
    hoverLight: 'hover:bg-rose-200',
    hoverDark: 'dark:hover:bg-rose-800/40',
    border: 'border-rose-200 dark:border-rose-700',
  },
  'platform-data': {
    bgLight: 'bg-rose-100',
    textLight: 'text-rose-800',
    bgDark: 'dark:bg-rose-900/30',
    textDark: 'dark:text-rose-300',
    hoverLight: 'hover:bg-rose-200',
    hoverDark: 'dark:hover:bg-rose-800/40',
    border: 'border-rose-200 dark:border-rose-700',
  },
  'platform-preregistration': {
    bgLight: 'bg-rose-100',
    textLight: 'text-rose-800',
    bgDark: 'dark:bg-rose-900/30',
    textDark: 'dark:text-rose-300',
    hoverLight: 'hover:bg-rose-200',
    hoverDark: 'dark:hover:bg-rose-800/40',
    border: 'border-rose-200 dark:border-rose-700',
  },
  'platform-protocol': {
    bgLight: 'bg-rose-100',
    textLight: 'text-rose-800',
    bgDark: 'dark:bg-rose-900/30',
    textDark: 'dark:text-rose-300',
    hoverLight: 'hover:bg-rose-200',
    hoverDark: 'dark:hover:bg-rose-800/40',
    border: 'border-rose-200 dark:border-rose-700',
  },
  'supplementary-category': {
    bgLight: 'bg-teal-100',
    textLight: 'text-teal-800',
    bgDark: 'dark:bg-teal-900/30',
    textDark: 'dark:text-teal-300',
    hoverLight: 'hover:bg-teal-200',
    hoverDark: 'dark:hover:bg-teal-800/40',
    border: 'border-teal-200 dark:border-teal-700',
  },
  'presentation-type': {
    bgLight: 'bg-slate-100',
    textLight: 'text-slate-800',
    bgDark: 'dark:bg-slate-800',
    textDark: 'dark:text-slate-300',
    hoverLight: 'hover:bg-slate-200',
    hoverDark: 'dark:hover:bg-slate-700',
    border: 'border-slate-200 dark:border-slate-600',
  },
  'institution-type': {
    bgLight: 'bg-blue-100',
    textLight: 'text-blue-800',
    bgDark: 'dark:bg-blue-900/30',
    textDark: 'dark:text-blue-300',
    hoverLight: 'hover:bg-blue-200',
    hoverDark: 'dark:hover:bg-blue-800/40',
    border: 'border-blue-200 dark:border-blue-700',
  },
  'contribution-degree': {
    bgLight: 'bg-violet-100',
    textLight: 'text-violet-800',
    bgDark: 'dark:bg-violet-900/30',
    textDark: 'dark:text-violet-300',
    hoverLight: 'hover:bg-violet-200',
    hoverDark: 'dark:hover:bg-violet-800/40',
    border: 'border-violet-200 dark:border-violet-700',
  },
  'access-type': {
    bgLight: 'bg-emerald-100',
    textLight: 'text-emerald-800',
    bgDark: 'dark:bg-emerald-900/30',
    textDark: 'dark:text-emerald-300',
    hoverLight: 'hover:bg-emerald-200',
    hoverDark: 'dark:hover:bg-emerald-800/40',
    border: 'border-emerald-200 dark:border-emerald-700',
  },
  'endorsement-contribution': {
    bgLight: 'bg-amber-100',
    textLight: 'text-amber-800',
    bgDark: 'dark:bg-amber-900/30',
    textDark: 'dark:text-amber-300',
    hoverLight: 'hover:bg-amber-200',
    hoverDark: 'dark:hover:bg-amber-800/40',
    border: 'border-amber-200 dark:border-amber-700',
  },

  // Object nodes (@ trigger)
  institution: {
    bgLight: 'bg-blue-100',
    textLight: 'text-blue-800',
    bgDark: 'dark:bg-blue-900/30',
    textDark: 'dark:text-blue-300',
    hoverLight: 'hover:bg-blue-200',
    hoverDark: 'dark:hover:bg-blue-800/40',
    border: 'border-blue-200 dark:border-blue-700',
  },
  person: {
    bgLight: 'bg-pink-100',
    textLight: 'text-pink-800',
    bgDark: 'dark:bg-pink-900/30',
    textDark: 'dark:text-pink-300',
    hoverLight: 'hover:bg-pink-200',
    hoverDark: 'dark:hover:bg-pink-800/40',
    border: 'border-pink-200 dark:border-pink-700',
  },
  event: {
    bgLight: 'bg-orange-100',
    textLight: 'text-orange-800',
    bgDark: 'dark:bg-orange-900/30',
    textDark: 'dark:text-orange-300',
    hoverLight: 'hover:bg-orange-200',
    hoverDark: 'dark:hover:bg-orange-800/40',
    border: 'border-orange-200 dark:border-orange-700',
  },

  // Default fallback
  default: {
    bgLight: 'bg-gray-100',
    textLight: 'text-gray-800',
    bgDark: 'dark:bg-gray-800',
    textDark: 'dark:text-gray-300',
    hoverLight: 'hover:bg-gray-200',
    hoverDark: 'dark:hover:bg-gray-700',
    border: 'border-gray-200 dark:border-gray-600',
  },
};

// =============================================================================
// ICONS
// =============================================================================

/**
 * Lucide icons for each subkind.
 */
export const SUBKIND_ICONS: Record<string, LucideIcon> = {
  // Type nodes
  field: Layers,
  facet: Tag,
  'contribution-type': Award,
  'contribution-degree': Award,
  'document-format': FileType,
  license: Scale,
  'publication-status': Clock,
  'paper-type': FileText,
  motivation: Lightbulb,
  'platform-code': Server,
  'platform-data': Server,
  'platform-preregistration': Server,
  'platform-protocol': Server,
  'supplementary-category': Sparkles,
  'presentation-type': Sparkles,
  'institution-type': Building2,
  'access-type': Scale,
  'endorsement-contribution': Award,

  // Object nodes
  institution: Building2,
  person: User,
  event: Calendar,

  // Default
  default: Network,
};

/**
 * Human-readable labels for subkinds.
 */
export const SUBKIND_DISPLAY_LABELS: Record<string, string> = {
  // Type nodes
  field: 'Field',
  facet: 'Facet',
  'contribution-type': 'Contribution',
  'contribution-degree': 'Degree',
  'document-format': 'Format',
  license: 'License',
  'publication-status': 'Status',
  'paper-type': 'Paper Type',
  motivation: 'Motivation',
  'platform-code': 'Code Platform',
  'platform-data': 'Data Platform',
  'platform-preregistration': 'Preregistration',
  'platform-protocol': 'Protocol Platform',
  'supplementary-category': 'Supplement',
  'presentation-type': 'Presentation',
  'institution-type': 'Institution Type',
  'access-type': 'Access Type',
  'endorsement-contribution': 'Endorsement',

  // Object nodes
  institution: 'Institution',
  person: 'Person',
  event: 'Event',

  // Default
  default: 'Node',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get combined Tailwind classes for a subkind.
 *
 * @param subkind - The subkind slug (e.g., 'field', 'institution')
 * @returns Combined Tailwind classes for the subkind color
 *
 * @example
 * ```tsx
 * <Badge className={getSubkindColorClasses('field')}>
 *   Machine Learning
 * </Badge>
 * ```
 */
export function getSubkindColorClasses(subkind: string): string {
  const config = SUBKIND_COLORS[subkind] ?? SUBKIND_COLORS.default;
  return [
    config.bgLight,
    config.textLight,
    config.bgDark,
    config.textDark,
    config.hoverLight,
    config.hoverDark,
  ].join(' ');
}

/**
 * Get the color config for a subkind.
 *
 * @param subkind - The subkind slug
 * @returns The color configuration
 */
export function getSubkindColorConfig(subkind: string): SubkindColorConfig {
  return SUBKIND_COLORS[subkind] ?? SUBKIND_COLORS.default;
}

/**
 * Get the icon component for a subkind.
 *
 * @param subkind - The subkind slug
 * @returns The Lucide icon component
 */
export function getSubkindIcon(subkind: string): LucideIcon {
  return SUBKIND_ICONS[subkind] ?? SUBKIND_ICONS.default;
}

/**
 * Get the display label for a subkind.
 *
 * @param subkind - The subkind slug
 * @returns The human-readable label
 */
export function getSubkindLabel(subkind: string): string {
  return SUBKIND_DISPLAY_LABELS[subkind] ?? SUBKIND_DISPLAY_LABELS.default;
}

/**
 * Get badge classes for editor chips (includes border).
 *
 * @param subkind - The subkind slug
 * @returns Combined Tailwind classes including border
 */
export function getSubkindChipClasses(subkind: string): string {
  const config = SUBKIND_COLORS[subkind] ?? SUBKIND_COLORS.default;
  return [
    config.bgLight,
    config.textLight,
    config.bgDark,
    config.textDark,
    config.border,
    'border',
  ].join(' ');
}
