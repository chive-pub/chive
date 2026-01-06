/**
 * Skip link for keyboard/screen reader users to bypass navigation.
 * Required by WCAG 2.2 AA per accessibility.md.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:top-4 focus:left-4 focus:rounded-md"
    >
      Skip to main content
    </a>
  );
}
