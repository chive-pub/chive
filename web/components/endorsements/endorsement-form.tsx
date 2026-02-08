'use client';

/**
 * Form dialog for creating an endorsement.
 *
 * @remarks
 * Allows users to select one or more contribution types from 15 fine-grained
 * categories derived from the CRediT taxonomy.
 *
 * @example
 * ```tsx
 * <EndorsementForm
 *   eprintUri={eprintUri}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSubmit={handleSubmit}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import {
  FlaskConical,
  LineChart,
  Lightbulb,
  Database,
  Brain,
  Wrench,
  Table,
  Copy,
  RefreshCw,
  Layers,
  Network,
  GraduationCap,
  BarChart3,
  Globe,
  Stethoscope,
  Send,
  type LucideIcon,
} from 'lucide-react';

// Using simple dialog implementation to avoid React 19 + Radix infinite loop issue
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useMemo } from 'react';
import type { ContributionType } from '@/lib/api/schema';
import {
  useEndorsementCategories,
  type EndorsementCategory,
} from '@/lib/hooks/use-endorsement-data';
import type { GraphNode } from '@/lib/hooks/use-nodes';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for EndorsementForm.
 */
export interface EndorsementFormProps {
  /** AT-URI of the eprint */
  eprintUri: string;

  /** Dialog open state */
  open: boolean;

  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;

  /** Callback when form is submitted */
  onSubmit: (data: EndorsementFormData) => void | Promise<void>;

  /** Loading state */
  isLoading?: boolean;

  /** Error message */
  error?: string;

  /** Initial selected contributions (for editing) */
  initialContributions?: ContributionType[];

  /** Initial comment (for editing) */
  initialComment?: string;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Data submitted from endorsement form.
 */
export interface EndorsementFormData {
  eprintUri: string;
  contributions: ContributionType[];
  comment?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

interface ContributionOption {
  type: ContributionType;
  icon: LucideIcon;
  label: string;
  description: string;
}

/**
 * Icon mapping for endorsement types.
 *
 * Maps endorsement type slugs to Lucide icons for UI display.
 */
const ENDORSEMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  methodological: FlaskConical,
  analytical: LineChart,
  theoretical: Lightbulb,
  empirical: Database,
  conceptual: Brain,
  technical: Wrench,
  data: Table,
  replication: Copy,
  reproducibility: RefreshCw,
  synthesis: Layers,
  interdisciplinary: Network,
  pedagogical: GraduationCap,
  visualization: BarChart3,
  'societal-impact': Globe,
  clinical: Stethoscope,
};

/**
 * Extracts slug from endorsement type node.
 */
function getEndorsementTypeSlug(node: GraphNode): string {
  return node.metadata?.slug ?? node.label.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Converts endorsement category to contribution category format.
 */
function mapCategoryToContributionOptions(
  category: EndorsementCategory
): Array<{ name: string; options: ContributionOption[] }> {
  const options: ContributionOption[] = [];

  for (const type of category.types) {
    const slug = getEndorsementTypeSlug(type);
    const icon = ENDORSEMENT_TYPE_ICONS[slug] ?? FlaskConical;

    options.push({
      type: slug as ContributionType,
      icon,
      label: type.label,
      description: type.description ?? '',
    });
  }

  if (options.length === 0) {
    return [];
  }

  return [
    {
      name: category.name,
      options,
    },
  ];
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Stable empty array to use as default value for initialContributions.
 * This prevents the useEffect from running on every render due to new array references.
 */
const EMPTY_CONTRIBUTIONS: ContributionType[] = [];

/**
 * Dialog form for creating endorsements.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function EndorsementForm({
  eprintUri,
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  error,
  initialContributions = EMPTY_CONTRIBUTIONS,
  initialComment = '',
  className,
}: EndorsementFormProps) {
  const [contributions, setContributions] = useState<ContributionType[]>(initialContributions);
  const [comment, setComment] = useState(initialComment);

  // Reset form state when initial values change (when editing different endorsement)
  useEffect(() => {
    setContributions(initialContributions);
    setComment(initialComment);
  }, [initialContributions, initialComment]);

  const { data: categoriesData, isLoading: isLoadingTypes } = useEndorsementCategories();

  const groupedOptions = useMemo(() => {
    if (!categoriesData || categoriesData.length === 0) {
      return [];
    }

    const result: Array<{ name: string; options: ContributionOption[] }> = [];
    for (const category of categoriesData) {
      const mapped = mapCategoryToContributionOptions(category);
      result.push(...mapped);
    }
    return result;
  }, [categoriesData]);

  const toggleContribution = useCallback((type: ContributionType) => {
    setContributions((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (contributions.length === 0) {
        return; // Validation: at least one contribution type required
      }

      await onSubmit({
        eprintUri,
        contributions,
        comment: comment.trim() || undefined,
      });

      // Reset form on success
      setComment('');
      setContributions([]);
    },
    [eprintUri, contributions, comment, onSubmit]
  );

  const isValid = contributions.length > 0;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key and focus trap
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus the dialog
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Only render the dialog when open
  if (!open) return null;

  return (
    // Simple custom dialog to avoid React 19 + Radix infinite loop issue
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endorsement-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog content */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-lg sm:rounded-lg max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <h2
              id="endorsement-dialog-title"
              className="text-lg font-semibold leading-none tracking-tight"
            >
              Endorse this eprint
            </h2>
            <p className="text-sm text-muted-foreground">
              Select one or more contribution types that you are endorsing.
            </p>
          </div>

          <div className="space-y-6 py-4">
            {/* Contribution type selection by category */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Contribution types</Label>
                <span className="text-xs text-muted-foreground">
                  {contributions.length} selected
                </span>
              </div>

              {isLoadingTypes ? (
                <div className="text-sm text-muted-foreground">Loading endorsement types...</div>
              ) : (
                groupedOptions.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{category.name}</h4>
                    <div className="grid gap-2">
                      {category.options.map((option) => {
                        const Icon = option.icon;
                        const isSelected = contributions.includes(option.type);
                        return (
                          <div
                            key={option.type}
                            className={cn(
                              'flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                            )}
                            onClick={() => toggleContribution(option.type)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleContribution(option.type)}
                              onClick={(e) => e.stopPropagation()}
                              id={option.type}
                            />
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={option.type} className="font-medium cursor-pointer">
                                {option.label}
                              </Label>
                              <p className="text-xs text-muted-foreground truncate">
                                {option.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {contributions.length === 0 && (
                <p className="text-sm text-destructive">
                  Please select at least one contribution type.
                </p>
              )}
            </div>

            {/* Optional comment */}
            <div className="space-y-2">
              <Label htmlFor="endorsement-comment">
                Comment <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="endorsement-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a brief comment about your endorsement..."
                className="min-h-[80px] resize-none"
                maxLength={5000}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/5000</p>
            </div>

            {/* Error display */}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isValid} className="gap-2">
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit endorsement
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
