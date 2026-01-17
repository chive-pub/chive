'use client';

/**
 * CRediT (Contributor Roles Taxonomy) autocomplete component.
 *
 * @remarks
 * Provides selection from the 14 standard CRediT roles defined by NISO.
 * Used in governance proposals for contribution type mappings.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 *
 * @example
 * ```tsx
 * <CreditAutocomplete
 *   value={creditUri}
 *   onSelect={(role) => {
 *     setValue('creditUri', role.creditUri);
 *     setValue('croUri', role.croUri);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Check, ExternalLink, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// =============================================================================
// TYPES
// =============================================================================

/**
 * CRediT role definition from NISO standard.
 */
export interface CreditRole {
  /** Role identifier (kebab-case) */
  id: string;
  /** Display label */
  label: string;
  /** Full description from CRediT specification */
  description: string;
  /** CRediT URI (canonical identifier) */
  creditUri: string;
  /** CRO (Contributor Role Ontology) URI */
  croUri: string;
}

/**
 * Props for CreditAutocomplete component.
 */
export interface CreditAutocompleteProps {
  /** Current selected CRediT URI */
  value?: string;
  /** Called when a role is selected */
  onSelect: (role: CreditRole) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
}

// =============================================================================
// DATA
// =============================================================================

/**
 * The 14 CRediT (Contributor Roles Taxonomy) roles.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 */
export const CREDIT_ROLES: readonly CreditRole[] = [
  {
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims.',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000064',
  },
  {
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later re-use.',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000025',
  },
  {
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data.',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000006',
  },
  {
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description:
      'Acquisition of the financial support for the project leading to this publication.',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000020',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection.',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000052',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models.',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000029',
  },
  {
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution.',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000053',
  },
  {
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools.',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000054',
  },
  {
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components.',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000015',
  },
  {
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team.',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000055',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs.',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000056',
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation.',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000059',
  },
  {
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000057',
  },
  {
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000058',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete selector for CRediT contributor roles.
 *
 * @param props - Component props
 * @returns CRediT autocomplete element
 */
export function CreditAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = 'Select CRediT role...',
  disabled = false,
  className,
  id,
}: CreditAutocompleteProps) {
  const [open, setOpen] = useState(false);

  // Find currently selected role by URI
  const selectedRole = useMemo(() => {
    if (!value) return null;
    return CREDIT_ROLES.find((role) => role.creditUri === value) ?? null;
  }, [value]);

  const handleSelect = useCallback(
    (role: CreditRole) => {
      onSelect(role);
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onClear?.();
    setOpen(false);
  }, [onClear]);

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !selectedRole && 'text-muted-foreground'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedRole ? selectedRole.label : placeholder}</span>
            </div>
            {selectedRole && (
              <a
                href={selectedRole.creditUri}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 hover:text-primary"
                title="View on CRediT"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search roles..." />
            <CommandList>
              <CommandEmpty>No roles found.</CommandEmpty>
              <CommandGroup>
                {CREDIT_ROLES.map((role) => {
                  const isSelected = selectedRole?.id === role.id;
                  return (
                    <CommandItem
                      key={role.id}
                      value={role.label}
                      onSelect={() => handleSelect(role)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{role.label}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {role.description}
                        </p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Get CRediT role by URI.
 *
 * @param uri - CRediT URI
 * @returns CRediT role or undefined
 */
export function getCreditRoleByUri(uri: string): CreditRole | undefined {
  return CREDIT_ROLES.find((role) => role.creditUri === uri);
}

/**
 * Get CRediT role by ID.
 *
 * @param id - Role ID (kebab-case)
 * @returns CRediT role or undefined
 */
export function getCreditRoleById(id: string): CreditRole | undefined {
  return CREDIT_ROLES.find((role) => role.id === id);
}
