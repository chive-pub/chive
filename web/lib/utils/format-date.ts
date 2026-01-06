/**
 * Date formatting utilities for Chive frontend.
 *
 * @remarks
 * Provides consistent date formatting across the application.
 * Uses Intl.DateTimeFormat for locale-aware formatting.
 *
 * @packageDocumentation
 */

/**
 * Options for date formatting.
 */
export interface FormatDateOptions {
  /** Include time in the output */
  includeTime?: boolean;
  /** Use relative time (e.g., "2 days ago") if within threshold */
  relative?: boolean;
  /** Threshold in milliseconds for relative time (default: 7 days) */
  relativeThreshold?: number;
}

const DEFAULT_RELATIVE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Formats a date for display.
 *
 * @param date - Date to format (string, number, or Date object)
 * @param options - Formatting options
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatDate('2024-01-15T10:30:00Z')
 * // Returns "Jan 15, 2024"
 *
 * formatDate('2024-01-15T10:30:00Z', { includeTime: true })
 * // Returns "Jan 15, 2024, 10:30 AM"
 *
 * formatDate(Date.now() - 3600000, { relative: true })
 * // Returns "1 hour ago"
 * ```
 */
export function formatDate(date: string | number | Date, options: FormatDateOptions = {}): string {
  const {
    includeTime = false,
    relative = false,
    relativeThreshold = DEFAULT_RELATIVE_THRESHOLD,
  } = options;

  const dateObj = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  if (relative) {
    const now = Date.now();
    const diff = now - dateObj.getTime();

    if (diff >= 0 && diff < relativeThreshold) {
      return formatRelativeTime(diff);
    }
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  if (includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
}

/**
 * Formats a time difference as a relative string.
 *
 * @param diffMs - Difference in milliseconds
 * @returns Relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  return 'just now';
}

/**
 * Formats a date as a relative time string.
 *
 * @param date - Date to format (string, number, or Date object)
 * @returns Relative time string (e.g., "2 hours ago", "3 days ago", or formatted date)
 *
 * @example
 * ```typescript
 * formatRelativeDate('2024-01-15T10:30:00Z')
 * // Returns "3 days ago" (if within 7 days)
 * // Or "Jan 15, 2024" (if older than 7 days)
 * ```
 */
export function formatRelativeDate(date: string | number | Date): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const now = Date.now();
  const diff = now - dateObj.getTime();

  // If in the future or older than 7 days, show absolute date
  if (diff < 0 || diff > DEFAULT_RELATIVE_THRESHOLD) {
    return formatDate(date);
  }

  return formatRelativeTime(diff);
}

/**
 * Formats a date range for display.
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string
 *
 * @example
 * ```typescript
 * formatDateRange('2024-01-15', '2024-01-20')
 * // Returns "Jan 15 - 20, 2024"
 *
 * formatDateRange('2024-01-15', '2024-02-20')
 * // Returns "Jan 15 - Feb 20, 2024"
 * ```
 */
export function formatDateRange(
  startDate: string | number | Date,
  endDate: string | number | Date
): string {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid date range';
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(end);
    return `${start.getDate()} - ${end.getDate()} ${monthYear}`;
  }

  if (sameYear) {
    const startStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(start);
    const endStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(end);
    return `${startStr} - ${endStr}`;
  }

  const startStr = formatDate(start);
  const endStr = formatDate(end);
  return `${startStr} - ${endStr}`;
}

/**
 * Formats a date for use in ISO 8601 format (YYYY-MM-DD).
 *
 * @param date - Date to format
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * formatISODate(new Date('2024-01-15T10:30:00Z'))
 * // Returns "2024-01-15"
 * ```
 */
export function formatISODate(date: string | number | Date): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toISOString().split('T')[0];
}
