'use client';

/**
 * Zenodo dataset/record autocomplete component.
 *
 * @remarks
 * Searches Zenodo for datasets, software, and publications.
 * Displays record title, DOI, type, and creators.
 *
 * @example
 * ```tsx
 * <ZenodoAutocomplete
 *   recordType="dataset"
 *   onSelect={(record) => {
 *     form.setValue('repositories.data[0].doi', record.doi);
 *     form.setValue('repositories.data[0].url', record.url);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { Database, FileCode, FileText, Package } from 'lucide-react';

import { logger } from '@/lib/observability';
import { AutocompleteInput } from './autocomplete-input';

const log = logger.child({ component: 'zenodo-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Zenodo record type.
 */
export type ZenodoRecordType =
  | 'dataset'
  | 'software'
  | 'publication'
  | 'poster'
  | 'presentation'
  | 'image'
  | 'video'
  | 'lesson'
  | 'other';

/**
 * Zenodo record entry.
 */
export interface ZenodoRecord {
  /** Record ID */
  id: number;
  /** DOI */
  doi: string | null;
  /** Record title */
  title: string;
  /** Record description (truncated) */
  description: string | null;
  /** Creator names */
  creators: string[];
  /** Record type */
  type: ZenodoRecordType;
  /** Publication date */
  publicationDate: string | null;
  /** Record URL */
  url: string;
  /** Access status */
  accessStatus: 'open' | 'restricted' | 'embargoed' | 'closed';
}

/**
 * Zenodo search response.
 */
interface ZenodoSearchResponse {
  hits: {
    total: number;
    hits: Array<{
      id: number;
      doi?: string;
      metadata: {
        title: string;
        description?: string;
        creators?: Array<{ name: string }>;
        resource_type?: { type: string };
        publication_date?: string;
        access_right?: string;
      };
      links: {
        self_html: string;
      };
    }>;
  };
}

/**
 * Props for ZenodoAutocomplete component.
 */
export interface ZenodoAutocompleteProps {
  /** Current value (DOI or URL) */
  value?: string;
  /** Called when record is selected */
  onSelect: (record: ZenodoRecord) => void;
  /** Called when input value changes */
  onChange?: (value: string) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Filter by record type */
  recordType?: ZenodoRecordType;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID */
  id?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ZENODO_API_URL = 'https://zenodo.org/api/records';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps Zenodo resource type to our type.
 */
function mapResourceType(type?: string): ZenodoRecordType {
  switch (type) {
    case 'dataset':
      return 'dataset';
    case 'software':
      return 'software';
    case 'publication':
      return 'publication';
    case 'poster':
      return 'poster';
    case 'presentation':
      return 'presentation';
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'lesson':
      return 'lesson';
    default:
      return 'other';
  }
}

/**
 * Gets icon component for record type.
 */
function getTypeIcon(type: ZenodoRecordType) {
  switch (type) {
    case 'dataset':
      return Database;
    case 'software':
      return FileCode;
    case 'publication':
      return FileText;
    default:
      return Package;
  }
}

/**
 * Transform Zenodo API response to our record type.
 */
function transformZenodoResponse(data: ZenodoSearchResponse): ZenodoRecord[] {
  return data.hits.hits.map((hit) => ({
    id: hit.id,
    doi: hit.doi ?? null,
    title: hit.metadata.title ?? '',
    description: hit.metadata.description?.slice(0, 200) ?? null,
    creators: (hit.metadata.creators ?? []).map((c) => c.name),
    type: mapResourceType(hit.metadata.resource_type?.type),
    publicationDate: hit.metadata.publication_date ?? null,
    url: hit.links.self_html,
    accessStatus: (hit.metadata.access_right as ZenodoRecord['accessStatus']) ?? 'open',
  }));
}

/**
 * Create search function for Zenodo with optional type filter.
 */
function createZenodoSearchFn(recordType?: ZenodoRecordType) {
  return async function searchZenodo(query: string): Promise<ZenodoRecord[]> {
    const params = new URLSearchParams({
      q: query,
      size: '10',
    });

    if (recordType) {
      params.append('type', recordType);
    }

    const response = await fetch(`${ZENODO_API_URL}?${params.toString()}`);

    if (!response.ok) {
      log.error('Zenodo search failed', undefined, {
        query,
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data: ZenodoSearchResponse = await response.json();
    return transformZenodoResponse(data);
  };
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single Zenodo record result.
 */
function ZenodoRecordResultItem({ record }: { record: ZenodoRecord }) {
  const Icon = getTypeIcon(record.type);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-blue-600" />
        <span className="text-sm font-medium line-clamp-1">{record.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {record.doi && <span className="font-mono text-blue-600">DOI: {record.doi}</span>}
        <span className="px-1.5 py-0.5 rounded bg-muted capitalize">{record.type}</span>
        {record.publicationDate && <span>({record.publicationDate.slice(0, 4)})</span>}
      </div>
      {record.creators.length > 0 && (
        <div className="text-xs text-muted-foreground truncate">
          {record.creators.slice(0, 2).join(', ')}
          {record.creators.length > 2 && ` +${record.creators.length - 2} more`}
        </div>
      )}
    </div>
  );
}

/**
 * Zenodo autocomplete component.
 *
 * @param props - Component props
 * @returns Zenodo autocomplete element
 */
export function ZenodoAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  recordType,
  placeholder = 'Search Zenodo...',
  disabled = false,
  className,
  id,
}: ZenodoAutocompleteProps) {
  const searchFn = useMemo(() => createZenodoSearchFn(recordType), [recordType]);

  const renderItem = useCallback(
    (record: ZenodoRecord) => <ZenodoRecordResultItem record={record} />,
    []
  );

  const getItemKey = useCallback((record: ZenodoRecord) => record.id.toString(), []);
  const getItemValue = useCallback((record: ZenodoRecord) => record.title, []);

  return (
    <AutocompleteInput<ZenodoRecord>
      id={id}
      placeholder={placeholder}
      groupLabel="Zenodo Records"
      queryFn={searchFn}
      queryKeyPrefix={`zenodo-search-${recordType ?? 'all'}`}
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={2}
      debounceMs={400}
      staleTime={60 * 1000}
      emptyMessage="No records found."
      disabled={disabled}
      className={className}
    />
  );
}
