'use client';

/**
 * Version bump selector for eprint updates.
 *
 * @remarks
 * Provides a selector for choosing the type of version bump when
 * updating an eprint. Explains the semantics of each version type.
 *
 * @packageDocumentation
 */

import { GitBranch, GitCommit, GitMerge } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { VersionBumpType } from '@/lib/hooks/use-eprint-mutations';

/**
 * Props for VersionSelector.
 */
export interface VersionSelectorProps {
  /** Currently selected version bump type */
  value: VersionBumpType;
  /** Callback when selection changes */
  onChange: (value: VersionBumpType) => void;
  /** Current version for display */
  currentVersion?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Version bump option configuration.
 */
interface VersionOption {
  value: VersionBumpType;
  label: string;
  description: string;
  examples: string[];
  icon: typeof GitBranch;
}

const versionOptions: VersionOption[] = [
  {
    value: 'patch',
    label: 'Patch',
    description: 'Typo fixes, formatting corrections, citation updates',
    examples: ['Fixed typos', 'Updated citations', 'Corrected formatting'],
    icon: GitCommit,
  },
  {
    value: 'minor',
    label: 'Minor',
    description: 'New content, significant additions, new analysis',
    examples: ['Added new section', 'Expanded analysis', 'New experimental results'],
    icon: GitBranch,
  },
  {
    value: 'major',
    label: 'Major',
    description: 'Fundamental revision, methodology changes, major corrections',
    examples: ['Complete rewrite', 'New methodology', 'Major correction'],
    icon: GitMerge,
  },
];

/**
 * Version bump selector component.
 *
 * @param props - component props
 * @param props.value - currently selected version bump type
 * @param props.onChange - callback invoked when selection changes
 * @param props.currentVersion - current version string for display (optional)
 * @param props.disabled - whether the selector is disabled
 * @returns React element rendering the version bump radio group
 *
 * @example
 * ```tsx
 * const [versionBump, setVersionBump] = useState<VersionBumpType>('patch');
 *
 * <VersionSelector
 *   value={versionBump}
 *   onChange={setVersionBump}
 *   currentVersion="1.2.3"
 * />
 * ```
 */
export function VersionSelector({
  value,
  onChange,
  currentVersion,
  disabled = false,
}: VersionSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Version Bump Type</Label>
        {currentVersion && (
          <span className="text-sm text-muted-foreground">Current: v{currentVersion}</span>
        )}
      </div>

      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as VersionBumpType)}
        disabled={disabled}
        className="space-y-3"
      >
        {versionOptions.map((option) => {
          const Icon = option.icon;
          return (
            <div
              key={option.value}
              className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                value === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !disabled && onChange(option.value)}
              role="presentation"
            >
              <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor={option.value}
                    className="text-sm font-medium cursor-pointer leading-none"
                  >
                    {option.label}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {option.examples.map((example) => (
                    <span
                      key={example}
                      className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
