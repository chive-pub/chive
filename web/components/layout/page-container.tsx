/**
 * Page container component with standardized width variants.
 *
 * @remarks
 * Provides consistent page layouts across the application.
 * Width variants are designed for different content types:
 * - `narrow`: Forms, submission pages (768px)
 * - `reading`: Long-form content, article detail (896px)
 * - `browse`: Grid views, search results (1280px)
 * - `full`: Container default, sidebar layouts (1400px)
 *
 * @example
 * ```tsx
 * // Form page
 * <PageContainer variant="narrow">
 *   <SubmitForm />
 * </PageContainer>
 *
 * // Browse page
 * <PageContainer variant="browse">
 *   <SearchResults />
 * </PageContainer>
 * ```
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Width variant options for page containers.
 */
export type PageContainerVariant = 'narrow' | 'reading' | 'browse' | 'full';

/**
 * Props for PageContainer component.
 */
export interface PageContainerProps {
  /** Child content */
  children: React.ReactNode;

  /**
   * Width variant for the container.
   *
   * @remarks
   * - `narrow`: 768px (max-w-3xl) - Best for forms and focused content
   * - `reading`: 896px (max-w-4xl) - Best for articles and long-form text
   * - `browse`: 1280px (max-w-7xl) - Best for grids and search results
   * - `full`: 1400px (container default) - Best for sidebar layouts
   */
  variant: PageContainerVariant;

  /** Additional CSS classes */
  className?: string;

  /** Whether to include standard vertical padding (default: true) */
  padding?: boolean;

  /** HTML element to render as (default: 'div') */
  as?: 'div' | 'main' | 'section' | 'article';
}

// =============================================================================
// STYLES
// =============================================================================

/**
 * Width classes for each variant.
 */
const variantStyles: Record<PageContainerVariant, string> = {
  narrow: 'max-w-3xl', // 768px (forms)
  reading: 'max-w-4xl', // 896px (reading)
  browse: 'max-w-7xl', // 1280px (browse/search)
  full: '', // container default (1400px)
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Container component with standardized width variants.
 *
 * @param props - Component props
 * @returns Container element
 */
export function PageContainer({
  children,
  variant,
  className,
  padding = true,
  as: Component = 'div',
}: PageContainerProps) {
  return (
    <Component
      className={cn('container mx-auto', variantStyles[variant], padding && 'py-8', className)}
    >
      {children}
    </Component>
  );
}

/**
 * Get the CSS class for a specific variant.
 *
 * @param variant - Width variant
 * @returns Tailwind CSS class string
 *
 * @example
 * ```typescript
 * const className = getVariantClass('browse'); // 'max-w-7xl'
 * ```
 */
export function getVariantClass(variant: PageContainerVariant): string {
  return variantStyles[variant];
}
