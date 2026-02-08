'use client';

/**
 * File upload step for eprint submission.
 *
 * @remarks
 * Step 1 of the submission wizard. Handles:
 * - Primary document upload (PDF, DOCX, HTML, Markdown, LaTeX, Jupyter, etc.)
 * - Auto-detection of document format
 *
 * Supplementary materials are handled in the next step (step-supplementary).
 *
 * @packageDocumentation
 */

import { useCallback, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FileText, FileCheck } from 'lucide-react';

import { FileDropzone, type SelectedFile } from '@/components/forms';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDocumentFormats } from '@/lib/hooks/use-nodes';
import type { EprintFormValues } from './submission-wizard';
import type { DocumentFormat } from '@/lib/api/generated/types/pub/chive/defs';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepFiles component.
 */
export interface StepFilesProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Accepted MIME types for primary document upload.
 * Supports all manuscript formats.
 */
const DOCUMENT_ACCEPT = {
  // Tier 1 - Essential (95%+ of submissions)
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/html': ['.html', '.htm'],
  'text/markdown': ['.md', '.markdown'],
  'text/x-markdown': ['.md', '.markdown'],

  // Tier 2 - Important (40%+ in specialized fields)
  'text/x-tex': ['.tex'],
  'application/x-tex': ['.tex', '.latex'],
  'application/x-ipynb+json': ['.ipynb'],
  'application/vnd.oasis.opendocument.text': ['.odt'],

  // Tier 3 - Supplementary formats
  'application/rtf': ['.rtf'],
  'text/rtf': ['.rtf'],
  'application/epub+zip': ['.epub'],
  'text/plain': ['.txt'],
};

const MAX_DOCUMENT_SIZE = 52428800; // 50MB

/**
 * Maps file extensions to document formats.
 */
const EXTENSION_TO_FORMAT: Record<string, DocumentFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
  latex: 'latex',
  ipynb: 'jupyter',
  odt: 'odt',
  rtf: 'rtf',
  epub: 'epub',
  txt: 'txt',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Detects document format from filename.
 */
function detectFormatFromFilename(filename: string): DocumentFormat | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? EXTENSION_TO_FORMAT[ext] : undefined;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * File upload step component.
 *
 * @param props - Component props
 * @returns File upload step element
 */
export function StepFiles({ form, className }: StepFilesProps) {
  const documentFile = form.watch('documentFile');
  const documentFormat = form.watch('documentFormat');

  // Fetch document formats from knowledge graph
  const { data: formatsData } = useDocumentFormats();
  const formatLabels: Record<string, string> =
    formatsData?.nodes.reduce<Record<string, string>>((acc, node) => {
      const slug = node.metadata?.slug ?? node.label.toLowerCase().replace(/\s+/g, '_');
      acc[slug] = node.label;
      return acc;
    }, {}) ?? {};

  // Auto-detect format when file changes
  useEffect(() => {
    if (documentFile) {
      const detected = detectFormatFromFilename(documentFile.name);
      if (detected && detected !== documentFormat) {
        form.setValue('documentFormat', detected, { shouldValidate: true });
      }
    } else if (documentFormat) {
      form.setValue('documentFormat', undefined, { shouldValidate: true });
    }
  }, [documentFile, documentFormat, form]);

  // Handle primary document selection
  const handleDocumentSelect = useCallback(
    (files: SelectedFile[]) => {
      const validFile = files.find((f) => f.isValid);
      if (validFile) {
        form.setValue('documentFile', validFile.file, { shouldValidate: true });
      }
    },
    [form]
  );

  // Handle document removal
  const handleDocumentRemove = useCallback(() => {
    form.setValue('documentFile', undefined, { shouldValidate: true });
    form.setValue('documentFormat', undefined, { shouldValidate: true });
  }, [form]);

  // Document selected files for display
  const documentSelectedFiles: SelectedFile[] = documentFile
    ? [{ file: documentFile, isValid: true }]
    : [];

  return (
    <div className={cn('space-y-8', className)}>
      {/* Primary Document */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Primary Document
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your eprint manuscript. Supports PDF, Word, HTML, Markdown, LaTeX, Jupyter
            notebooks, and more. Maximum file size is 50MB.
          </p>
        </div>

        <FileDropzone
          accept={DOCUMENT_ACCEPT}
          maxSize={MAX_DOCUMENT_SIZE}
          maxFiles={1}
          selectedFiles={documentSelectedFiles}
          onFileSelect={handleDocumentSelect}
          onFileRemove={handleDocumentRemove}
          placeholder="Drop your document here or click to browse"
          helpText="PDF, DOCX, HTML, MD, TEX, IPYNB, ODT, RTF, EPUB, TXT accepted"
        />

        {/* Detected format indicator */}
        {documentFormat && (
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Detected format:</span>
            <Badge variant="secondary">{formatLabels[documentFormat] ?? documentFormat}</Badge>
          </div>
        )}

        {form.formState.errors.documentFile && (
          <p className="text-sm text-destructive" data-testid="validation-error">
            {form.formState.errors.documentFile.message}
          </p>
        )}
      </section>

      {/* File Requirements */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">Supported Document Formats</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground mb-4">
          <div>
            <strong>Tier 1:</strong> PDF, DOCX, HTML, Markdown
          </div>
          <div>
            <strong>Tier 2:</strong> LaTeX, Jupyter, ODT
          </div>
          <div>
            <strong>Tier 3:</strong> RTF, EPUB, Plain Text
          </div>
        </div>
        <h4 className="font-medium mb-2">File Requirements</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Documents should not be password-protected</li>
          <li>All text should be selectable (not scanned images)</li>
          <li>LaTeX files should compile without errors</li>
          <li>Jupyter notebooks should include all outputs</li>
          <li>Maximum file size: 50MB</li>
        </ul>
      </section>
    </div>
  );
}
