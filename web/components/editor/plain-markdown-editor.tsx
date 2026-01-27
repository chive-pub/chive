'use client';

/**
 * Plaintext markdown editor using @uiw/react-md-editor.
 *
 * @remarks
 * A plaintext editor where users write and see raw markdown syntax directly.
 * Features:
 * - Shows actual markdown characters (e.g., `**bold**`, `*italic*`)
 * - Toolbar buttons insert markdown syntax into text
 * - Preview mode renders the markdown
 * - Character count with optional limit
 * - LaTeX equation support via $...$ and $$...$$ syntax
 *
 * @example
 * ```tsx
 * <PlainMarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Write your abstract using Markdown..."
 *   enablePreview
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Eye, Edit3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RichTextContent } from './types';

// Dynamic import to avoid SSR issues with the md-editor
const MDEditor = dynamic(() => import('@uiw/react-md-editor').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-background animate-pulse" style={{ minHeight: '150px' }} />
  ),
});

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for PlainMarkdownEditor component.
 */
export interface PlainMarkdownEditorProps {
  /** Current content value (plain markdown text) */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Minimum height for the editor */
  minHeight?: string;
  /** Enable preview mode toggle */
  enablePreview?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Test ID for the editor container */
  testId?: string;
}

/**
 * Props for PlainMarkdownEditor with RichTextContent value type.
 * For compatibility with existing form patterns.
 */
export interface PlainMarkdownEditorRichTextProps {
  /** Current content value (RichTextContent) */
  value: RichTextContent;
  /** Callback when content changes */
  onChange: (content: RichTextContent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Minimum height for the editor */
  minHeight?: string;
  /** Enable preview mode toggle */
  enablePreview?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Test ID for the editor container */
  testId?: string;
  /** Enable LaTeX support (included for API compatibility, always supported) */
  enableLatex?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Plaintext markdown editor that shows raw markdown syntax.
 *
 * @param props - Component props
 * @returns The editor element
 */
export function PlainMarkdownEditor({
  value,
  onChange,
  placeholder = 'Write using Markdown...',
  disabled = false,
  maxLength,
  minHeight = '150px',
  enablePreview = true,
  showToolbar = true,
  className,
  autoFocus = false,
  ariaLabel = 'Markdown editor',
  testId,
}: PlainMarkdownEditorProps): React.JSX.Element {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      const text = newValue ?? '';
      // Enforce max length if specified
      if (maxLength !== undefined && text.length > maxLength) {
        return;
      }
      onChange(text);
    },
    [onChange, maxLength]
  );

  const togglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  // Calculate character count
  const charCount = value?.length ?? 0;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  // Parse minHeight to get numeric value for the editor
  const minHeightNum = parseInt(minHeight, 10) || 150;

  // Don't render editor on server
  if (!isMounted) {
    return (
      <div
        className={cn('rounded-md border bg-background', disabled && 'opacity-50', className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border bg-background',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled && 'opacity-50 pointer-events-none',
        isOverLimit && 'border-destructive',
        className
      )}
      data-testid={testId}
      data-disabled={disabled || undefined}
      data-color-mode="light"
    >
      {/* Custom preview toggle */}
      {enablePreview && (
        <div className="flex items-center justify-end border-b px-2 py-1">
          <Button variant="ghost" size="sm" onClick={togglePreview} className="gap-1 h-8">
            {isPreviewMode ? (
              <>
                <Edit3 className="h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Preview
              </>
            )}
          </Button>
        </div>
      )}

      {/* MD Editor */}
      <div className="[&_.w-md-editor]:border-0 [&_.w-md-editor]:rounded-none [&_.w-md-editor]:shadow-none">
        <MDEditor
          value={value}
          onChange={handleChange}
          preview={isPreviewMode ? 'preview' : 'edit'}
          hideToolbar={!showToolbar}
          height={minHeightNum}
          textareaProps={{
            placeholder,
            disabled,
            'aria-label': ariaLabel,
            autoFocus,
          }}
          visibleDragbar={false}
        />
      </div>

      {/* Footer with character count */}
      {maxLength !== undefined && (
        <div className="flex items-center justify-end border-t px-3 py-1">
          <span
            className={cn(
              'text-xs tabular-nums text-muted-foreground',
              isOverLimit && 'text-destructive font-medium'
            )}
          >
            {charCount}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Plaintext markdown editor with RichTextContent interface.
 *
 * @remarks
 * This is a wrapper that accepts RichTextContent for compatibility
 * with existing form patterns, but internally works with plain text.
 *
 * @param props - Component props
 * @returns The editor element
 */
export function PlainMarkdownEditorRichText({
  value,
  onChange,
  placeholder = 'Write using Markdown...',
  disabled = false,
  maxLength,
  minHeight = '150px',
  enablePreview = true,
  showToolbar = true,
  className,
  autoFocus = false,
  ariaLabel = 'Markdown editor',
  testId,
}: PlainMarkdownEditorRichTextProps): React.JSX.Element {
  // Extract plain text from RichTextContent
  const textValue = value?.text ?? '';

  // Convert plain text back to RichTextContent on change
  const handleChange = useCallback(
    (text: string) => {
      onChange({
        text,
        html: text, // For plaintext markdown, html is the same as text
        facets: [], // Facets would be parsed from markdown if needed
      });
    },
    [onChange]
  );

  return (
    <PlainMarkdownEditor
      value={textValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      minHeight={minHeight}
      enablePreview={enablePreview}
      showToolbar={showToolbar}
      className={className}
      autoFocus={autoFocus}
      ariaLabel={ariaLabel}
      testId={testId}
    />
  );
}

export default PlainMarkdownEditor;
