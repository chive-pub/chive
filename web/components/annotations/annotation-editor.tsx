'use client';

/**
 * FOVEA-style annotation editor with embedded knowledge graph references.
 *
 * @remarks
 * Supports trigger-based autocomplete for inserting references:
 * - `@wikidata:` - Wikidata entities
 * - `@authority:` - Chive authority records
 * - `@field:` - Knowledge graph fields
 * - `@eprint:` - Other eprints
 * - `^` - Other annotations
 *
 * @example
 * ```tsx
 * <AnnotationEditor
 *   value={body}
 *   onChange={setBody}
 *   placeholder="Add your annotation..."
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AtSign } from 'lucide-react';

import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RichAnnotationBody, RichAnnotationItem } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for AnnotationEditor.
 */
export interface AnnotationEditorProps {
  /** Current annotation body */
  value: RichAnnotationBody | null;

  /** Callback when body changes */
  onChange: (body: RichAnnotationBody) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Maximum character count for text content */
  maxLength?: number;

  /** Minimum rows */
  minRows?: number;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Reference trigger configuration.
 */
interface ReferenceTrigger {
  pattern: RegExp;
  type: RichAnnotationItem['type'];
  label: string;
  description: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REFERENCE_TRIGGERS: ReferenceTrigger[] = [
  {
    pattern: /@wikidata:/,
    type: 'wikidataRef',
    label: '@wikidata:',
    description: 'Link to Wikidata entity',
  },
  {
    pattern: /@authority:/,
    type: 'authorityRef',
    label: '@authority:',
    description: 'Link to authority record',
  },
  {
    pattern: /@field:/,
    type: 'fieldRef',
    label: '@field:',
    description: 'Link to knowledge field',
  },
  {
    pattern: /@eprint:/,
    type: 'eprintRef',
    label: '@eprint:',
    description: 'Link to eprint',
  },
  {
    pattern: /\^/,
    type: 'annotationRef',
    label: '^',
    description: 'Reference another annotation',
  },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse plain text into annotation body items.
 * For now, just wraps text - reference parsing to be implemented.
 */
function parseTextToBody(text: string): RichAnnotationBody {
  // Simple implementation: just text for now.
  // Full parsing would detect @wikidata:Q123 patterns and convert them
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

/**
 * Convert annotation body to plain text for editing.
 */
function bodyToText(body: RichAnnotationBody | null): string {
  if (!body?.items) return '';

  return body.items
    .map((item) => {
      switch (item.type) {
        case 'text':
          return item.content;
        case 'wikidataRef':
          return `@wikidata:${item.qid}`;
        case 'authorityRef':
          return `@authority:${item.uri}`;
        case 'fieldRef':
          return `@field:${item.uri}`;
        case 'eprintRef':
          return `@eprint:${item.uri}`;
        case 'annotationRef':
          return `^${item.uri}`;
        case 'authorRef':
          return `@${item.displayName}`;
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Get text content length from body.
 */
function getTextLength(body: RichAnnotationBody | null): number {
  if (!body?.items) return 0;

  return body.items.reduce((sum: number, item: RichAnnotationItem) => {
    if (item.type === 'text') {
      return sum + item.content.length;
    }
    // References count as their display length
    return sum + 10; // Approximate
  }, 0);
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Rich text editor for annotations with reference autocomplete.
 *
 * @param props - Component props
 * @returns Editor element
 */
export function AnnotationEditor({
  value,
  onChange,
  placeholder = 'Add your annotation...',
  disabled = false,
  maxLength = 5000,
  minRows = 3,
  className,
}: AnnotationEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => bodyToText(value));
  const [showTriggerHelp, setShowTriggerHelp] = useState(false);

  // Sync external value changes
  useEffect(() => {
    const newText = bodyToText(value);
    if (newText !== text) {
      setText(newText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      // Parse and update body
      const newBody = parseTextToBody(newText);
      onChange(newBody);

      // Show trigger help when @ is typed
      if (newText.endsWith('@')) {
        setShowTriggerHelp(true);
      } else {
        setShowTriggerHelp(false);
      }
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape closes trigger help
      if (e.key === 'Escape' && showTriggerHelp) {
        setShowTriggerHelp(false);
        e.preventDefault();
      }
    },
    [showTriggerHelp]
  );

  const insertTrigger = useCallback(
    (trigger: ReferenceTrigger) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Remove the @ that triggered the menu and insert the full trigger
      const before = text.slice(0, start - 1);
      const after = text.slice(end);
      const newText = before + trigger.label + after;

      setText(newText);
      onChange(parseTextToBody(newText));
      setShowTriggerHelp(false);

      // Move cursor after trigger
      setTimeout(() => {
        const newPos = start - 1 + trigger.label.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [text, onChange]
  );

  const currentLength = getTextLength(value);
  const isOverLimit = currentLength > maxLength;

  return (
    <div className={cn('relative', className)} data-testid="annotation-editor">
      {/* Trigger help popover */}
      <Popover open={showTriggerHelp} onOpenChange={setShowTriggerHelp}>
        <PopoverTrigger asChild>
          <div className="absolute inset-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-2"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="text-xs text-muted-foreground mb-2">Insert reference:</p>
          <div className="space-y-1">
            {REFERENCE_TRIGGERS.map((trigger) => (
              <button
                key={trigger.label}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => insertTrigger(trigger)}
              >
                <Badge variant="outline" className="text-xs font-mono">
                  {trigger.label}
                </Badge>
                <span className="text-muted-foreground">{trigger.description}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Text area */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'resize-y',
          isOverLimit && 'border-destructive focus-visible:ring-destructive'
        )}
        style={{ minHeight: `${minRows * 1.5}rem` }}
        aria-describedby="annotation-editor-help"
      />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => setShowTriggerHelp(true)}
          disabled={disabled}
        >
          <AtSign className="h-3 w-3" />
          Insert reference
        </button>
        <span
          id="annotation-editor-help"
          className={cn(isOverLimit && 'text-destructive font-medium')}
        >
          {currentLength}/{maxLength}
        </span>
      </div>
    </div>
  );
}

/**
 * Displays preview of annotation body with rendered references.
 */
export function AnnotationPreview({
  body,
  className,
}: {
  body: RichAnnotationBody | null;
  className?: string;
}) {
  if (!body?.items || body.items.length === 0) {
    return <div className={cn('text-muted-foreground italic', className)}>No content</div>;
  }

  return (
    <div className={cn('whitespace-pre-wrap', className)}>
      {body.items.map((item, index) => {
        switch (item.type) {
          case 'text':
            return <span key={index}>{item.content}</span>;
          case 'wikidataRef':
            return (
              <Badge
                key={index}
                variant="secondary"
                className="mx-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {item.label}
              </Badge>
            );
          case 'authorityRef':
            return (
              <Badge
                key={index}
                variant="secondary"
                className="mx-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
              >
                {item.label}
              </Badge>
            );
          case 'fieldRef':
            return (
              <Badge
                key={index}
                variant="secondary"
                className="mx-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              >
                {item.label}
              </Badge>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
