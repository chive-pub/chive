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
 *   preprintUri={preprintUri}
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
import { useEffect, useRef } from 'react';
import type { ContributionType } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for EndorsementForm.
 */
export interface EndorsementFormProps {
  /** AT-URI of the preprint */
  preprintUri: string;

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
  preprintUri: string;
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
 * Contribution type options grouped by category.
 */
const CONTRIBUTION_CATEGORIES: Array<{
  name: string;
  options: ContributionOption[];
}> = [
  {
    name: 'Core Research',
    options: [
      {
        type: 'methodological',
        icon: FlaskConical,
        label: 'Methodological',
        description: 'Novel methods, techniques, approaches, protocols',
      },
      {
        type: 'analytical',
        icon: LineChart,
        label: 'Analytical',
        description: 'Statistical, computational, or mathematical analysis',
      },
      {
        type: 'theoretical',
        icon: Lightbulb,
        label: 'Theoretical',
        description: 'Theoretical framework, conceptual model, theory development',
      },
      {
        type: 'empirical',
        icon: Database,
        label: 'Empirical',
        description: 'Data collection, experiments, observations, fieldwork',
      },
      {
        type: 'conceptual',
        icon: Brain,
        label: 'Conceptual',
        description: 'Novel ideas, hypotheses, problem framing',
      },
    ],
  },
  {
    name: 'Technical',
    options: [
      {
        type: 'technical',
        icon: Wrench,
        label: 'Technical',
        description: 'Software, tools, infrastructure, instrumentation',
      },
      {
        type: 'data',
        icon: Table,
        label: 'Data',
        description: 'Dataset creation, curation, availability',
      },
    ],
  },
  {
    name: 'Validation',
    options: [
      {
        type: 'replication',
        icon: Copy,
        label: 'Replication',
        description: 'Successful replication of prior work',
      },
      {
        type: 'reproducibility',
        icon: RefreshCw,
        label: 'Reproducibility',
        description: 'Code/materials availability, reproducible workflow',
      },
    ],
  },
  {
    name: 'Synthesis',
    options: [
      {
        type: 'synthesis',
        icon: Layers,
        label: 'Synthesis',
        description: 'Literature review, meta-analysis, systematic review',
      },
      {
        type: 'interdisciplinary',
        icon: Network,
        label: 'Interdisciplinary',
        description: 'Cross-disciplinary integration, bridging fields',
      },
    ],
  },
  {
    name: 'Communication',
    options: [
      {
        type: 'pedagogical',
        icon: GraduationCap,
        label: 'Pedagogical',
        description: 'Educational value, clarity of exposition',
      },
      {
        type: 'visualization',
        icon: BarChart3,
        label: 'Visualization',
        description: 'Figures, graphics, data presentation',
      },
    ],
  },
  {
    name: 'Impact',
    options: [
      {
        type: 'societal-impact',
        icon: Globe,
        label: 'Societal Impact',
        description: 'Real-world applications, policy implications',
      },
      {
        type: 'clinical',
        icon: Stethoscope,
        label: 'Clinical',
        description: 'Clinical relevance (for medical/health research)',
      },
    ],
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dialog form for creating endorsements.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function EndorsementForm({
  preprintUri,
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  error,
  initialContributions = [],
  initialComment = '',
  className,
}: EndorsementFormProps) {
  const [contributions, setContributions] = useState<ContributionType[]>(initialContributions);
  const [comment, setComment] = useState(initialComment);

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
        preprintUri,
        contributions,
        comment: comment.trim() || undefined,
      });

      // Reset form on success
      setComment('');
      setContributions([]);
    },
    [preprintUri, contributions, comment, onSubmit]
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
              Endorse this preprint
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

              {CONTRIBUTION_CATEGORIES.map((category) => (
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
              ))}

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
