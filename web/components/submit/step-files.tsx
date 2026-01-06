'use client';

/**
 * File upload step for preprint submission.
 *
 * @remarks
 * Step 1 of the submission wizard. Handles:
 * - Primary PDF document upload
 * - Optional supplementary files
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FileText, Plus } from 'lucide-react';

import { FileDropzone, type SelectedFile } from '@/components/forms';
import { cn } from '@/lib/utils';
import type { PreprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepFiles component.
 */
export interface StepFilesProps {
  /** React Hook Form instance */
  form: UseFormReturn<PreprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PDF_ACCEPT = {
  'application/pdf': ['.pdf'],
};

const SUPPLEMENTARY_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_SUPPLEMENTARY_SIZE = 100 * 1024 * 1024; // 100MB per file
const MAX_SUPPLEMENTARY_FILES = 10;

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
  const pdfFile = form.watch('pdfFile');
  const watchedSupplementaryFiles = form.watch('supplementaryFiles');
  const supplementaryFiles = useMemo(
    () => watchedSupplementaryFiles ?? [],
    [watchedSupplementaryFiles]
  );

  // Handle primary PDF selection
  const handlePdfSelect = useCallback(
    (files: SelectedFile[]) => {
      const validFile = files.find((f) => f.isValid);
      if (validFile) {
        form.setValue('pdfFile', validFile.file, { shouldValidate: true });
      }
    },
    [form]
  );

  // Handle PDF removal
  const handlePdfRemove = useCallback(() => {
    form.setValue('pdfFile', undefined, { shouldValidate: true });
  }, [form]);

  // Handle supplementary file selection
  const handleSupplementarySelect = useCallback(
    (files: SelectedFile[]) => {
      const validFiles = files.filter((f) => f.isValid).map((f) => f.file);
      form.setValue('supplementaryFiles', [...supplementaryFiles, ...validFiles], {
        shouldValidate: true,
      });
    },
    [form, supplementaryFiles]
  );

  // Handle supplementary file removal
  const handleSupplementaryRemove = useCallback(
    (file: SelectedFile) => {
      const updated = supplementaryFiles.filter((f) => f !== file.file);
      form.setValue('supplementaryFiles', updated, { shouldValidate: true });
    },
    [form, supplementaryFiles]
  );

  // Convert File array to SelectedFile array for display
  const supplementarySelectedFiles: SelectedFile[] = supplementaryFiles.map((file) => ({
    file,
    isValid: true,
  }));

  // PDF selected files for display
  const pdfSelectedFiles: SelectedFile[] = pdfFile ? [{ file: pdfFile, isValid: true }] : [];

  return (
    <div className={cn('space-y-8', className)}>
      {/* Primary PDF */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Primary Document
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your preprint as a PDF file. Maximum file size is 50MB.
          </p>
        </div>

        <FileDropzone
          accept={PDF_ACCEPT}
          maxSize={MAX_PDF_SIZE}
          maxFiles={1}
          selectedFiles={pdfSelectedFiles}
          onFileSelect={handlePdfSelect}
          onFileRemove={handlePdfRemove}
          placeholder="Drop your PDF here or click to browse"
          helpText="PDF format only, max 50MB"
        />

        {form.formState.errors.pdfFile && (
          <p className="text-sm text-destructive" data-testid="validation-error">
            {form.formState.errors.pdfFile.message}
          </p>
        )}
      </section>

      {/* Supplementary Files */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Supplementary Materials
            <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add any supporting files such as data, code, or additional figures. Maximum 10 files,
            100MB each.
          </p>
        </div>

        <FileDropzone
          accept={SUPPLEMENTARY_ACCEPT}
          maxSize={MAX_SUPPLEMENTARY_SIZE}
          maxFiles={MAX_SUPPLEMENTARY_FILES}
          selectedFiles={supplementarySelectedFiles}
          onFileSelect={handleSupplementarySelect}
          onFileRemove={handleSupplementaryRemove}
          placeholder="Drop supplementary files here or click to browse"
          helpText="PDF, ZIP, CSV, JSON, PNG, JPG accepted"
        />
      </section>

      {/* File Requirements */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">File Requirements</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>PDF must be readable and not password-protected</li>
          <li>All text should be selectable (not scanned images)</li>
          <li>Figures and tables should be embedded in the document</li>
          <li>Maximum file size: 50MB for primary, 100MB per supplementary file</li>
        </ul>
      </section>
    </div>
  );
}
