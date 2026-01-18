'use client';

/**
 * FOVEA-style annotation editor with embedded knowledge graph references.
 *
 * @remarks
 * Supports trigger-based autocomplete for inserting references:
 * - `@` - Object nodes (institutions, persons, topics, geographic, events)
 * - `#` - Type nodes (fields, facets, contribution-types, licenses, etc.)
 *
 * Uses contenteditable with inline chips for rich text editing.
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

import { useCallback, useRef, useEffect, useState } from 'react';
import { AtSign, Hash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMentionTrigger, type MentionTriggerType } from '@/lib/hooks/use-mention-trigger';
import { NodeMentionAutocomplete } from './node-mention-autocomplete';
import {
  serializeToBody,
  renderBodyToHTML,
  extractPlainText,
} from '@/lib/utils/annotation-serializer';
import type { RichAnnotationBody } from '@/lib/api/schema';
import type { NodeResult } from '@/components/knowledge-graph/node-search';

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

  /** Minimum height */
  minHeight?: string;

  /** Additional CSS classes */
  className?: string;

  /** Which triggers are enabled */
  enabledTriggers?: MentionTriggerType[];

  /** Autofocus on mount */
  autoFocus?: boolean;
}

// =============================================================================
// STYLES
// =============================================================================

const editorStyles = `
  .annotation-editor-content {
    outline: none;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .annotation-editor-content:empty::before {
    content: attr(data-placeholder);
    color: hsl(var(--muted-foreground));
    pointer-events: none;
    position: absolute;
  }

  .annotation-editor-content .mention-chip {
    display: inline;
    user-select: all;
    cursor: pointer;
  }

  .annotation-editor-content .mention-chip:focus {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 1px;
    border-radius: 4px;
  }
`;

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
  minHeight = '6rem',
  className,
  enabledTriggers = ['@', '#'],
  autoFocus = false,
}: AnnotationEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isInternalUpdate = useRef(false);

  // Initialize mention trigger detection
  const {
    state: mentionState,
    handleInput: triggerHandleInput,
    insertChip,
    close: closeTrigger,
  } = useMentionTrigger(editableRef, {
    minQueryLength: 1,
    enabledTriggers,
  });

  // Initialize editor content from value
  useEffect(() => {
    if (!editableRef.current || isInitialized) return;

    const html = renderBodyToHTML(value);
    editableRef.current.innerHTML = html || '';
    setIsInitialized(true);
  }, [value, isInitialized]);

  // Sync external value changes (only if not from internal update)
  useEffect(() => {
    if (!editableRef.current || !isInitialized || isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    // Compare current content with new value
    const currentBody = serializeToBody(editableRef.current);
    const currentText = extractPlainText(currentBody);
    const newText = extractPlainText(value);

    // Only update if content actually differs
    if (currentText !== newText) {
      const html = renderBodyToHTML(value);
      editableRef.current.innerHTML = html || '';
    }
  }, [value, isInitialized]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (!editableRef.current) return;

    // Trigger mention detection
    triggerHandleInput();

    // Serialize and notify parent
    const body = serializeToBody(editableRef.current);
    isInternalUpdate.current = true;
    onChange(body);
  }, [triggerHandleInput, onChange]);

  // Handle keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Handle backspace on chip - delete entire chip
      if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          // Check if cursor is right after a chip
          if (range.collapsed && range.startOffset === 0) {
            const prevSibling = range.startContainer.previousSibling;
            if (
              prevSibling instanceof HTMLElement &&
              prevSibling.classList.contains('mention-chip')
            ) {
              e.preventDefault();
              prevSibling.remove();
              handleInput();
              return;
            }
          }
        }
      }

      // Let mention trigger handle certain keys when autocomplete is open
      if (mentionState.isOpen) {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
          e.preventDefault();
          // These are handled by NodeMentionAutocomplete's global listener
        }
      }
    },
    [mentionState.isOpen, handleInput]
  );

  // Handle node selection from autocomplete
  const handleNodeSelect = useCallback(
    (node: NodeResult, trigger: MentionTriggerType) => {
      insertChip(node, trigger);

      // Re-serialize after chip insertion
      if (editableRef.current) {
        const body = serializeToBody(editableRef.current);
        isInternalUpdate.current = true;
        onChange(body);
      }
    },
    [insertChip, onChange]
  );

  // Handle paste - strip formatting
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    // Insert plain text at cursor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // Autofocus
  useEffect(() => {
    if (autoFocus && editableRef.current && !disabled) {
      editableRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Calculate character count
  const currentLength = extractPlainText(value).length;
  const isOverLimit = currentLength > maxLength;

  return (
    <>
      {/* Inject styles */}
      <style>{editorStyles}</style>

      <div className={cn('relative', className)} data-testid="annotation-editor">
        {/* Contenteditable editor */}
        <div
          ref={editableRef}
          contentEditable={!disabled}
          className={cn(
            'annotation-editor-content',
            'relative w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          style={{ minHeight }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          aria-label="Annotation editor"
          aria-describedby="annotation-editor-help"
          role="textbox"
          aria-multiline="true"
          aria-disabled={disabled}
        />

        {/* Mention autocomplete */}
        {mentionState.isOpen && mentionState.position && (
          <NodeMentionAutocomplete
            trigger={mentionState.trigger!}
            query={mentionState.query}
            position={mentionState.position}
            onSelect={handleNodeSelect}
            onClose={closeTrigger}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {enabledTriggers.includes('@') && (
              <span className="flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                <span>entities</span>
              </span>
            )}
            {enabledTriggers.includes('#') && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span>types</span>
              </span>
            )}
          </div>
          <span
            id="annotation-editor-help"
            className={cn(isOverLimit && 'text-destructive font-medium')}
          >
            {currentLength}/{maxLength}
          </span>
        </div>
      </div>
    </>
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
          case 'nodeRef':
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
