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
import { CREDIT_TAXONOMY, type CreditType } from '@/lib/constants/credit-taxonomy';

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
 * Map shared CreditType to CreditRole format for this component.
 */
function toCreditRole(t: CreditType): CreditRole {
  return {
    id: t.id,
    label: t.label,
    description: t.description,
    creditUri: t.creditUri,
    croUri: t.croUri,
  };
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
 * Mapped from shared CREDIT_TAXONOMY constant.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 */
export const CREDIT_ROLES: readonly CreditRole[] = CREDIT_TAXONOMY.map(toCreditRole);

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

  const _handleClear = useCallback(() => {
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
