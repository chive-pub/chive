import { cn } from '@/lib/utils';

/**
 * Props for the SearchHighlight component.
 */
export interface SearchHighlightProps {
  /** Text containing <em> tags for highlighted terms */
  text: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders search result text with highlighted matching terms.
 *
 * @remarks
 * Server component that parses HTML-style highlights from search results
 * and renders them with proper styling. Expects text with `<em>` tags
 * around matched terms (standard Elasticsearch highlight format).
 *
 * @example
 * ```tsx
 * <SearchHighlight text="Results for <em>quantum</em> computing" />
 * ```
 *
 * @param props - Component props
 * @returns React element with highlighted text
 */
export function SearchHighlight({ text, className }: SearchHighlightProps) {
  // Parse text and split on <em> tags
  const parts = parseHighlightedText(text);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark
            key={index}
            className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

/**
 * A text part that may be highlighted.
 */
interface TextPart {
  text: string;
  highlighted: boolean;
}

/**
 * Parses text with <em> tags into parts array.
 */
function parseHighlightedText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const regex = /<em>(.*?)<\/em>/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        highlighted: false,
      });
    }

    // Add the highlighted text
    parts.push({
      text: match[1],
      highlighted: true,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      highlighted: false,
    });
  }

  return parts;
}

/**
 * Props for the HighlightedSnippet component.
 */
export interface HighlightedSnippetProps {
  /** Array of snippet strings with highlights */
  snippets: string[];
  /** Maximum snippets to show */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays multiple highlighted snippets from search results.
 *
 * @example
 * ```tsx
 * <HighlightedSnippet
 *   snippets={searchResult.highlights.abstract.snippets}
 *   max={2}
 * />
 * ```
 */
export function HighlightedSnippet({ snippets, max = 3, className }: HighlightedSnippetProps) {
  const visibleSnippets = snippets.slice(0, max);

  return (
    <div className={cn('space-y-1 text-sm text-muted-foreground', className)}>
      {visibleSnippets.map((snippet, index) => (
        <p key={index} className="line-clamp-2">
          ...
          <SearchHighlight text={snippet} />
          ...
        </p>
      ))}
    </div>
  );
}
