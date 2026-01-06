'use client';

/**
 * Wizard progress indicator component.
 *
 * @remarks
 * Displays the current step in a multi-step form wizard.
 * Shows completed, current, and upcoming steps.
 *
 * @packageDocumentation
 */

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Step definition for the wizard.
 */
export interface WizardStep {
  /** Step ID */
  id: string;
  /** Step title */
  title: string;
  /** Short description */
  description?: string;
}

/**
 * Props for WizardProgress component.
 */
export interface WizardProgressProps {
  /** List of steps */
  steps: WizardStep[];
  /** Current step index (0-based) */
  currentStep: number;
  /** Callback when step is clicked */
  onStepClick?: (stepIndex: number) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Progress indicator for multi-step wizard forms.
 *
 * @param props - Component props
 * @returns Progress indicator element
 *
 * @example
 * ```tsx
 * <WizardProgress
 *   steps={[
 *     { id: 'files', title: 'Files' },
 *     { id: 'metadata', title: 'Metadata' },
 *     { id: 'review', title: 'Review' },
 *   ]}
 *   currentStep={1}
 * />
 * ```
 */
export function WizardProgress({
  steps,
  currentStep,
  onStepClick,
  className,
}: WizardProgressProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={cn(
                    'absolute left-0 top-4 -translate-y-1/2 h-0.5 w-[calc(50%-16px)]',
                    index <= currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                  aria-hidden="true"
                />
              )}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute right-0 top-4 -translate-y-1/2 h-0.5 w-[calc(50%-16px)]',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-background text-primary ring-4 ring-primary/20',
                  !isCompleted && !isCurrent && 'border-muted bg-background text-muted-foreground',
                  isClickable && 'cursor-pointer hover:bg-primary/10',
                  !isClickable && 'cursor-default'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>

              {/* Step title */}
              <div className="mt-2 text-center">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent && 'text-primary',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Compact mobile-friendly progress indicator.
 *
 * @param props - Component props
 * @returns Compact progress element
 */
export function WizardProgressCompact({
  steps,
  currentStep,
  className,
}: Omit<WizardProgressProps, 'onStepClick'>) {
  const current = steps[currentStep];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-1">
        {steps.map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-1.5 w-8 rounded-full',
              index < currentStep && 'bg-primary',
              index === currentStep && 'bg-primary',
              index > currentStep && 'bg-muted'
            )}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        Step {currentStep + 1} of {steps.length}
        {current && `: ${current.title}`}
      </span>
    </div>
  );
}
