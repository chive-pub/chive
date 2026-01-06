/**
 * Number formatting utilities for Chive frontend.
 *
 * @remarks
 * Provides consistent number formatting for views, downloads, and metrics.
 * Uses Intl.NumberFormat for locale-aware formatting.
 *
 * @packageDocumentation
 */

/**
 * Formats a number with compact notation for large values.
 *
 * @param value - Number to format
 * @returns Formatted string (e.g., "1.2K", "3.5M")
 *
 * @example
 * ```typescript
 * formatCompactNumber(1234)
 * // Returns "1.2K"
 *
 * formatCompactNumber(1234567)
 * // Returns "1.2M"
 *
 * formatCompactNumber(500)
 * // Returns "500"
 * ```
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  if (Math.abs(value) < 1000) {
    return value.toString();
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Formats a number with thousands separators.
 *
 * @param value - Number to format
 * @returns Formatted string with commas (e.g., "1,234,567")
 *
 * @example
 * ```typescript
 * formatNumber(1234567)
 * // Returns "1,234,567"
 * ```
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Formats a number as a percentage.
 *
 * @param value - Number to format (0-1 for percentages, or already multiplied by 100)
 * @param options - Formatting options
 * @returns Formatted percentage string
 *
 * @example
 * ```typescript
 * formatPercentage(0.75)
 * // Returns "75%"
 *
 * formatPercentage(0.756, { decimals: 1 })
 * // Returns "75.6%"
 * ```
 */
export function formatPercentage(
  value: number,
  options: { decimals?: number; isRaw?: boolean } = {}
): string {
  const { decimals = 0, isRaw = false } = options;

  if (!Number.isFinite(value)) {
    return '0%';
  }

  const percentage = isRaw ? value : value * 100;

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(isRaw ? percentage / 100 : value);
}

/**
 * Formats a metric value for display (views, downloads, endorsements).
 *
 * @param value - Metric value
 * @param label - Metric label (singular form)
 * @returns Formatted metric string
 *
 * @example
 * ```typescript
 * formatMetric(1, 'view')
 * // Returns "1 view"
 *
 * formatMetric(1234, 'view')
 * // Returns "1.2K views"
 *
 * formatMetric(0, 'download')
 * // Returns "0 downloads"
 * ```
 */
export function formatMetric(value: number, label: string): string {
  const formattedValue = formatCompactNumber(value);
  const pluralLabel = value === 1 ? label : `${label}s`;
  return `${formattedValue} ${pluralLabel}`;
}

/**
 * Formats a file size in bytes to human-readable format.
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 *
 * @example
 * ```typescript
 * formatFileSize(1024)
 * // Returns "1 KB"
 *
 * formatFileSize(1536000)
 * // Returns "1.5 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formattedSize = unitIndex === 0 ? size.toString() : size.toFixed(1).replace(/\.0$/, '');

  return `${formattedSize} ${units[unitIndex]}`;
}

/**
 * Formats an h-index value for display.
 *
 * @param value - h-index value
 * @returns Formatted h-index string
 *
 * @example
 * ```typescript
 * formatHIndex(25)
 * // Returns "h-index: 25"
 *
 * formatHIndex(undefined)
 * // Returns "h-index: N/A"
 * ```
 */
export function formatHIndex(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 'h-index: N/A';
  }
  return `h-index: ${value}`;
}
