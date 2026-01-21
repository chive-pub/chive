'use client';

/**
 * ReviewForm component for creating and editing reviews.
 *
 * @remarks
 * A form component that supports:
 * - Plain text input with character count
 * - Optional target span display (for inline annotations)
 * - Parent review reference (for replies)
 * - Markdown preview (future enhancement)
 *
 * @example
 * ```tsx
 * <ReviewForm
 *   eprintUri="at://did:plc:.../pub.chive.eprint.submission/..."
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Reply, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { Review, UnifiedTextSpanTarget, AnnotationMotivation } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ReviewForm component.
 */
export interface ReviewFormProps {
  /** URI of the eprint being reviewed */
  eprintUri: string;

  /** Review to edit (if editing) */
  editingReview?: Review;

  /** Parent review (if replying) */
  parentReview?: Review;

  /** Target span (for inline annotations) */
  target?: UnifiedTextSpanTarget;

  /** Callback when form is submitted */
  onSubmit: (data: ReviewFormData) => void | Promise<void>;

  /** Callback when form is cancelled */
  onCancel?: () => void;

  /** Whether the form is in a loading/submitting state */
  isLoading?: boolean;

  /** Error message to display */
  error?: string;

  /** Placeholder text for the textarea */
  placeholder?: string;

  /** Maximum character count */
  maxLength?: number;

  /** Minimum character count */
  minLength?: number;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Data submitted from the review form.
 */
export interface ReviewFormData {
  /** Review content */
  content: string;

  /** Eprint being reviewed */
  eprintUri: string;

  /** Target span (for inline annotations) */
  target?: UnifiedTextSpanTarget;

  /** Parent review URI (for replies) */
  parentReviewUri?: string;

  /** Annotation motivation */
  motivation: AnnotationMotivation;
}

/**
 * Props for the TargetSpanPreview component.
 */
export interface TargetSpanPreviewProps {
  /** The target span to preview */
  target: UnifiedTextSpanTarget;

  /** Callback to remove the target */
  onRemove?: () => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the ParentReviewPreview component.
 */
export interface ParentReviewPreviewProps {
  /** The parent review */
  review: Review;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Displays a preview of the target span being annotated.
 */
export function TargetSpanPreview({ target, onRemove, className }: TargetSpanPreviewProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3',
        className
      )}
      data-testid="target-span-preview"
    >
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">Commenting on:</p>
        <blockquote className="text-sm italic text-foreground">
          &ldquo;{target.selector?.exact}&rdquo;
        </blockquote>
        {target.refinedBy?.pageNumber && (
          <p className="text-xs text-muted-foreground mt-1">Page {target.refinedBy.pageNumber}</p>
        )}
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
          aria-label="Remove target selection"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * Displays a preview of the parent review being replied to.
 */
export function ParentReviewPreview({ review, className }: ParentReviewPreviewProps) {
  const truncatedContent =
    review.content.length > 100 ? review.content.slice(0, 100) + '...' : review.content;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-muted bg-muted/50 p-3',
        className
      )}
      data-testid="parent-review-preview"
    >
      <Reply className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          Replying to {review.author.displayName || review.author.handle}:
        </p>
        <p className="text-sm text-foreground truncate">{truncatedContent}</p>
      </div>
    </div>
  );
}

/**
 * Character count indicator with warning states.
 */
function CharacterCount({ current, min, max }: { current: number; min?: number; max?: number }) {
  const isBelowMin = min !== undefined && current < min;
  const isNearMax = max !== undefined && current > max * 0.9;
  const isOverMax = max !== undefined && current > max;

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        isOverMax
          ? 'text-destructive font-medium'
          : isNearMax
            ? 'text-warning'
            : isBelowMin
              ? 'text-muted-foreground'
              : 'text-muted-foreground'
      )}
      aria-live="polite"
    >
      {current}
      {max && `/${max}`}
      {min && current < min && ` (min ${min})`}
    </span>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Form for creating or editing reviews.
 *
 * @param props - Component props
 * @returns Review form element
 */
export function ReviewForm({
  eprintUri,
  editingReview,
  parentReview,
  target,
  onSubmit,
  onCancel,
  isLoading = false,
  error,
  placeholder = 'Share your thoughts on this eprint...',
  maxLength = 10000,
  minLength = 10,
  className,
}: ReviewFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(editingReview?.content || '');
  const [currentTarget, setCurrentTarget] = useState<UnifiedTextSpanTarget | undefined>(target);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Update target if prop changes
  useEffect(() => {
    setCurrentTarget(target);
  }, [target]);

  const isEditing = !!editingReview;
  const isReplying = !!parentReview;
  const hasTarget = !!currentTarget;

  // Determine motivation based on context
  const getMotivation = useCallback((): AnnotationMotivation => {
    if (isReplying) return 'replying';
    if (hasTarget) return 'commenting';
    return 'commenting';
  }, [isReplying, hasTarget]);

  const isValid =
    content.trim().length >= (minLength || 0) &&
    (maxLength === undefined || content.length <= maxLength);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValid || isLoading) return;

      const formData: ReviewFormData = {
        content: content.trim(),
        eprintUri,
        target: currentTarget,
        parentReviewUri: parentReview?.uri,
        motivation: getMotivation(),
      };

      await onSubmit(formData);
    },
    [content, eprintUri, currentTarget, parentReview, getMotivation, isValid, isLoading, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Ctrl/Cmd + Enter
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isValid && !isLoading) {
          handleSubmit(e as unknown as React.FormEvent);
        }
      }
    },
    [handleSubmit, isValid, isLoading]
  );

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)} data-testid="review-form">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isReplying ? (
          <Reply className="h-4 w-4 text-muted-foreground" />
        ) : (
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        )}
        <Label htmlFor="review-content" className="text-sm font-medium">
          {isEditing
            ? 'Edit your review'
            : isReplying
              ? 'Write a reply'
              : hasTarget
                ? 'Add annotation'
                : 'Write a review'}
        </Label>
      </div>

      {/* Parent review preview (if replying) */}
      {parentReview && <ParentReviewPreview review={parentReview} />}

      {/* Target span preview (if annotating) */}
      {currentTarget && (
        <TargetSpanPreview target={currentTarget} onRemove={() => setCurrentTarget(undefined)} />
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content textarea */}
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isReplying
              ? 'Write your reply...'
              : hasTarget
                ? 'Add your comment on this selection...'
                : placeholder
          }
          className="min-h-[120px] resize-y"
          disabled={isLoading}
          aria-describedby="review-char-count review-submit-hint"
          data-testid="review-content-input"
        />

        {/* Footer with character count and hint */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span id="review-submit-hint">
            Press <kbd className="px-1 py-0.5 rounded bg-muted">⌘</kbd>+
            <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> to submit
          </span>
          <span id="review-char-count">
            <CharacterCount current={content.length} min={minLength} max={maxLength} />
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!isValid || isLoading} className="gap-2">
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {isEditing ? 'Saving...' : 'Posting...'}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {isEditing ? 'Save changes' : isReplying ? 'Reply' : 'Post review'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * Compact inline form for quick replies.
 */
export function InlineReplyForm({
  eprintUri,
  parentReview,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: Omit<ReviewFormProps, 'editingReview' | 'target' | 'placeholder' | 'maxLength' | 'minLength'> & {
  parentReview: Review;
}) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (content.trim().length < 1 || isLoading) return;

      await onSubmit({
        content: content.trim(),
        eprintUri,
        parentReviewUri: parentReview.uri,
        motivation: 'replying',
      });

      setContent('');
    },
    [content, eprintUri, parentReview, isLoading, onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex items-center gap-2', className)}
      data-testid="inline-reply-form"
    >
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Reply to ${parentReview.author.displayName || 'this review'}...`}
        className="flex-1 h-8 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        disabled={content.trim().length < 1 || isLoading}
        className="h-8"
      >
        {isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Send className="h-3 w-3" />
        )}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8">
          <X className="h-3 w-3" />
        </Button>
      )}
    </form>
  );
}
