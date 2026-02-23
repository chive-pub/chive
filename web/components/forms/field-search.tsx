'use client';

/**
 * Multi-select field search component.
 *
 * @remarks
 * Thin wrapper around NodeAutocomplete for selecting multiple knowledge graph
 * field nodes. Manages the selected badges and delegates search to NodeAutocomplete.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { X, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { NodeAutocomplete, type NodeSuggestion } from './node-autocomplete';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Field reference for form state.
 */
export interface FieldSelection {
  /** AT-URI of the field node */
  uri: string;
  /** Field display label */
  label: string;
  /** Optional description */
  description?: string;
}

/**
 * Props for FieldSearch component.
 */
export interface FieldSearchProps {
  /** Currently selected fields */
  selectedFields: FieldSelection[];
  /** Callback when field is added */
  onFieldAdd: (field: FieldSelection) => void;
  /** Callback when field is removed */
  onFieldRemove: (field: FieldSelection) => void;
  /** Maximum number of fields allowed (default: 10) */
  maxFields?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label for the field list */
  label?: string;
  /** Help text displayed below input */
  helpText?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Multi-select field search using NodeAutocomplete.
 */
export function FieldSearch({
  selectedFields,
  onFieldAdd,
  onFieldRemove,
  maxFields = 10,
  placeholder = 'Search for a field...',
  disabled = false,
  className,
  label,
  helpText,
}: FieldSearchProps) {
  const canAddMore = selectedFields.length < maxFields;
  const selectedUris = useMemo(() => new Set(selectedFields.map((f) => f.uri)), [selectedFields]);

  const handleSelect = useCallback(
    (node: NodeSuggestion) => {
      if (!canAddMore || selectedUris.has(node.uri)) return;
      onFieldAdd({ uri: node.uri, label: node.label, description: node.description });
    },
    [canAddMore, selectedUris, onFieldAdd]
  );

  return (
    <div className={cn('space-y-3', className)} data-testid="field-search">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Selected fields */}
      {selectedFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFields.map((field) => (
            <Badge
              key={field.uri}
              variant="secondary"
              className="gap-1 py-1 pl-2 pr-1"
              data-testid="selected-field"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span>{field.label}</span>
              <button
                type="button"
                onClick={() => onFieldRemove(field)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove ${field.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Autocomplete - key resets component after each selection */}
      {canAddMore && (
        <NodeAutocomplete
          key={selectedFields.length}
          subkind="field"
          label="Field"
          placeholder={placeholder}
          disabled={disabled}
          onSelect={handleSelect}
          onClear={() => {}}
        />
      )}

      {/* Help text and count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {helpText && <span>{helpText}</span>}
        <span className="ml-auto">
          {selectedFields.length}/{maxFields} fields
        </span>
      </div>
    </div>
  );
}
