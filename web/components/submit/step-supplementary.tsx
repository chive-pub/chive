'use client';

/**
 * Supplementary materials step for eprint submission.
 *
 * @remarks
 * Handles supplementary file management with:
 * - Auto-detection of file format and category
 * - User override for detected category via dropdown
 * - Reordering with drag handles
 * - Label and description for each item
 * - Format icon and file size display
 *
 * @packageDocumentation
 */

import { useCallback, useState, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FileText,
  Image,
  Table2,
  Database,
  Code2,
  FileSpreadsheet,
  Video,
  AudioLines,
  Presentation,
  FlaskConical,
  ClipboardList,
  Paperclip,
  GripVertical,
  X,
  Plus,
} from 'lucide-react';

import {
  FileDropzone,
  ConceptAutocomplete,
  type SelectedFile,
  type ConceptSuggestion,
} from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EprintFormValues, SupplementaryMaterialInput } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepSupplementary component.
 */
export interface StepSupplementaryProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Known supplementary category slugs for auto-detection and icons.
 *
 * @remarks
 * Categories are now sourced from the knowledge graph via ConceptAutocomplete.
 * These slugs are used for auto-detection from file types and for icon display.
 */
const KNOWN_CATEGORY_SLUGS = [
  'appendix',
  'figure',
  'table',
  'dataset',
  'code',
  'notebook',
  'video',
  'audio',
  'presentation',
  'protocol',
  'questionnaire',
  'other',
] as const;

type KnownCategorySlug = (typeof KNOWN_CATEGORY_SLUGS)[number];

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Accepted MIME types for supplementary materials.
 */
const SUPPLEMENTARY_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/plain': ['.txt', '.py', '.r', '.js', '.ts', '.sh', '.R'],
  'application/x-ipynb+json': ['.ipynb'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/markdown': ['.md'],
  '*/*': [],
};

const MAX_SUPPLEMENTARY_SIZE = 104857600; // 100MB per file
const MAX_SUPPLEMENTARY_FILES = 50;

/**
 * Category labels for display (fallback when knowledge graph name not available).
 */
const CATEGORY_LABELS: Record<KnownCategorySlug, string> = {
  appendix: 'Appendix',
  figure: 'Figure',
  table: 'Table',
  dataset: 'Dataset',
  code: 'Code',
  notebook: 'Notebook',
  video: 'Video',
  audio: 'Audio',
  presentation: 'Presentation',
  protocol: 'Protocol',
  questionnaire: 'Questionnaire',
  other: 'Other',
};

/**
 * Category icons mapped by slug.
 */
const CATEGORY_ICONS: Record<KnownCategorySlug, React.ComponentType<{ className?: string }>> = {
  appendix: FileText,
  figure: Image,
  table: Table2,
  dataset: Database,
  code: Code2,
  notebook: FileSpreadsheet,
  video: Video,
  audio: AudioLines,
  presentation: Presentation,
  protocol: FlaskConical,
  questionnaire: ClipboardList,
  other: Paperclip,
};

/**
 * Gets icon for a category slug.
 */
function getCategoryIcon(slug: string): React.ComponentType<{ className?: string }> {
  if (slug in CATEGORY_ICONS) {
    return CATEGORY_ICONS[slug as KnownCategorySlug];
  }
  return Paperclip;
}

/**
 * Extension to category mapping for auto-detection.
 */
const EXTENSION_TO_CATEGORY: Record<string, KnownCategorySlug> = {
  // Figures
  png: 'figure',
  jpg: 'figure',
  jpeg: 'figure',
  gif: 'figure',
  svg: 'figure',
  tiff: 'figure',
  tif: 'figure',

  // Tables
  csv: 'table',
  xlsx: 'table',
  xls: 'table',
  tsv: 'table',

  // Datasets
  json: 'dataset',
  xml: 'dataset',
  hdf5: 'dataset',
  h5: 'dataset',
  nc: 'dataset',
  parquet: 'dataset',

  // Code
  py: 'code',
  r: 'code',
  js: 'code',
  ts: 'code',
  sh: 'code',
  m: 'code',
  cpp: 'code',
  c: 'code',
  java: 'code',
  go: 'code',
  rs: 'code',

  // Notebooks
  ipynb: 'notebook',
  rmd: 'notebook',
  qmd: 'notebook',

  // Video
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  avi: 'video',

  // Audio
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',

  // Presentations
  pptx: 'presentation',
  ppt: 'presentation',
  key: 'presentation',

  // Protocols
  docx: 'protocol',
  doc: 'protocol',
  odt: 'protocol',

  // Default
  pdf: 'appendix',
  zip: 'other',
  tar: 'other',
  gz: 'other',
};

/**
 * Filename patterns to category mapping.
 */
const FILENAME_PATTERNS: Array<{ pattern: RegExp; category: KnownCategorySlug }> = [
  { pattern: /appendix/i, category: 'appendix' },
  { pattern: /supplement(ary)?[\s_-]?text/i, category: 'appendix' },
  { pattern: /figure[\s_-]?s?\d*/i, category: 'figure' },
  { pattern: /fig[\s_-]?s?\d*/i, category: 'figure' },
  { pattern: /table[\s_-]?s?\d*/i, category: 'table' },
  { pattern: /data(set)?[\s_-]?\d*/i, category: 'dataset' },
  { pattern: /raw[\s_-]?data/i, category: 'dataset' },
  { pattern: /code|script|analysis/i, category: 'code' },
  { pattern: /notebook/i, category: 'notebook' },
  { pattern: /video|movie|animation/i, category: 'video' },
  { pattern: /audio|sound|recording/i, category: 'audio' },
  { pattern: /slides?|presentation/i, category: 'presentation' },
  { pattern: /protocol|method/i, category: 'protocol' },
  { pattern: /survey|questionnaire|form/i, category: 'questionnaire' },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Detects category slug from filename.
 */
function detectCategory(filename: string): KnownCategorySlug {
  // Check filename patterns first
  for (const { pattern, category } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return category;
    }
  }

  // Fall back to extension
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && ext in EXTENSION_TO_CATEGORY) {
    return EXTENSION_TO_CATEGORY[ext];
  }

  return 'other';
}

/**
 * Detects format from filename.
 */
function detectFormat(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ?? 'unknown';
}

/**
 * Generates a default label from filename.
 */
function generateLabel(filename: string, category: string): string {
  // Try to extract a meaningful label
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  // Replace common separators with spaces
  const words = nameWithoutExt.replace(/[-_]/g, ' ');

  // Capitalize first letter
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);

  // If it looks like a generic name, use category label
  if (/^(file|document|image|data)\s*\d*$/i.test(capitalized)) {
    const label =
      category in CATEGORY_LABELS
        ? CATEGORY_LABELS[category as KnownCategorySlug]
        : category.charAt(0).toUpperCase() + category.slice(1);
    return label;
  }

  return capitalized;
}

// =============================================================================
// SUPPLEMENTARY ITEM COMPONENT
// =============================================================================

interface SupplementaryItemProps {
  item: SupplementaryMaterialInput;
  index: number;
  onUpdate: (index: number, updates: Partial<SupplementaryMaterialInput>) => void;
  onRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragTarget: boolean;
}

function SupplementaryItem({
  item,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isDragging,
  isDragTarget,
}: SupplementaryItemProps) {
  const Icon = getCategoryIcon(item.category);

  // Handler for concept selection
  const handleConceptSelect = (concept: ConceptSuggestion) => {
    onUpdate(index, {
      category: concept.id, // slug
      categoryUri: concept.uri,
      categoryName: concept.name,
    });
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-all',
        isDragging && 'opacity-50',
        isDragTarget && 'border-primary border-2'
      )}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex gap-3">
        {/* Drag handle */}
        <div className="flex items-center cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          {/* File info */}
          <div className="flex items-center gap-2">
            <span className="font-medium truncate flex-1">{item.file.name}</span>
            <Badge variant="secondary" className="shrink-0">
              {formatFileSize(item.file.size)}
            </Badge>
            <Badge variant="outline" className="shrink-0">
              .{item.detectedFormat}
            </Badge>
          </div>

          {/* Label input */}
          <div className="space-y-1">
            <label htmlFor={`label-${index}`} className="text-xs text-muted-foreground">
              Label
            </label>
            <Input
              id={`label-${index}`}
              value={item.label}
              onChange={(e) => onUpdate(index, { label: e.target.value })}
              placeholder="e.g., Figure S1, Appendix A"
              className="h-8"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor={`desc-${index}`} className="text-xs text-muted-foreground">
              Description (optional)
            </label>
            <Textarea
              id={`desc-${index}`}
              value={item.description ?? ''}
              onChange={(e) => onUpdate(index, { description: e.target.value || undefined })}
              placeholder="Brief description of this material..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Category selector */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <ConceptAutocomplete
                  category="supplementary-type"
                  value={item.categoryUri}
                  onSelect={handleConceptSelect}
                  placeholder={
                    item.categoryName ??
                    (item.category in CATEGORY_LABELS
                      ? CATEGORY_LABELS[item.category as KnownCategorySlug]
                      : 'Select category...')
                  }
                  className="h-8"
                />
              </div>
            </div>
            {!item.categoryUri && (
              <p className="text-xs text-muted-foreground">
                Auto-detected:{' '}
                {item.category in CATEGORY_LABELS
                  ? CATEGORY_LABELS[item.category as KnownCategorySlug]
                  : item.category}
              </p>
            )}
          </div>
        </div>

        {/* Remove button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.file.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Supplementary materials step component.
 *
 * @param props - Component props
 * @returns Supplementary materials step element
 */
export function StepSupplementary({ form, className }: StepSupplementaryProps) {
  const watchedMaterials = form.watch('supplementaryMaterials');
  const materials = useMemo(() => watchedMaterials ?? [], [watchedMaterials]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);

  // Handle file selection from dropzone
  const handleFileSelect = useCallback(
    (files: SelectedFile[]) => {
      const validFiles = files.filter((f) => f.isValid);

      const newMaterials: SupplementaryMaterialInput[] = validFiles.map((f, i) => {
        const category = detectCategory(f.file.name);
        const format = detectFormat(f.file.name);
        return {
          file: f.file,
          label: generateLabel(f.file.name, category),
          description: undefined,
          category,
          detectedFormat: format,
          order: materials.length + i + 1,
        };
      });

      form.setValue('supplementaryMaterials', [...materials, ...newMaterials], {
        shouldValidate: true,
      });
    },
    [form, materials]
  );

  // Handle item update
  const handleUpdate = useCallback(
    (index: number, updates: Partial<SupplementaryMaterialInput>) => {
      const updated = materials.map((item, i) => (i === index ? { ...item, ...updates } : item));
      form.setValue('supplementaryMaterials', updated, { shouldValidate: true });
    },
    [form, materials]
  );

  // Handle item removal
  const handleRemove = useCallback(
    (index: number) => {
      const updated = materials
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order: i + 1 }));
      form.setValue('supplementaryMaterials', updated, { shouldValidate: true });
    },
    [form, materials]
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    setDragTargetIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragTargetIndex !== null && dragIndex !== dragTargetIndex) {
      const updated = [...materials];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(dragTargetIndex, 0, removed);

      // Update order numbers
      const reordered = updated.map((item, i) => ({ ...item, order: i + 1 }));
      form.setValue('supplementaryMaterials', reordered, { shouldValidate: true });
    }

    setDragIndex(null);
    setDragTargetIndex(null);
  }, [dragIndex, dragTargetIndex, materials, form]);

  // Convert materials to SelectedFile array for dropzone (used only for display count)
  const selectedFiles: SelectedFile[] = materials.map((m) => ({
    file: m.file,
    isValid: true,
  }));

  const canAddMore = materials.length < MAX_SUPPLEMENTARY_FILES;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Supplementary Materials
          <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add supporting files such as data, code, notebooks, figures, videos, or additional
          materials. Drag items to reorder. Maximum {MAX_SUPPLEMENTARY_FILES} files, 100MB each.
        </p>
      </div>

      {/* File dropzone */}
      {canAddMore && (
        <FileDropzone
          accept={SUPPLEMENTARY_ACCEPT}
          maxSize={MAX_SUPPLEMENTARY_SIZE}
          maxFiles={MAX_SUPPLEMENTARY_FILES - materials.length}
          selectedFiles={[]}
          onFileSelect={handleFileSelect}
          placeholder="Drop supplementary files here or click to browse"
          helpText="Data, code, figures, videos, and more"
        />
      )}

      {/* Materials list */}
      {materials.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {materials.length} {materials.length === 1 ? 'file' : 'files'} added
            </h4>
            <p className="text-xs text-muted-foreground">Drag to reorder</p>
          </div>

          <div className="space-y-2">
            {materials.map((item, index) => (
              <SupplementaryItem
                key={`${item.file.name}-${index}`}
                item={item}
                index={index}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                isDragging={dragIndex === index}
                isDragTarget={dragTargetIndex === index && dragIndex !== index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category guide */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-3">Category Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
            const CategoryIcon = CATEGORY_ICONS[category as KnownCategorySlug];
            return (
              <div key={category} className="flex items-center gap-2 text-muted-foreground">
                <CategoryIcon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Categories are auto-detected from file type and name. Search to select from the knowledge
          graph.
        </p>
      </section>
    </div>
  );
}
