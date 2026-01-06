'use client';

/**
 * File dropzone component for drag-and-drop file uploads.
 *
 * @remarks
 * Provides a file upload interface with:
 * - Drag and drop support
 * - File type validation
 * - File size validation
 * - Preview for PDFs and images
 *
 * @example
 * ```tsx
 * <FileDropzone
 *   accept={{ 'application/pdf': ['.pdf'] }}
 *   maxSize={50 * 1024 * 1024}
 *   onFileSelect={handleFile}
 *   onFileRemove={handleRemove}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Accepted file types configuration.
 */
export type AcceptedFileTypes = Record<string, string[]>;

/**
 * Selected file with metadata.
 */
export interface SelectedFile {
  /** The file object */
  file: File;
  /** Preview URL (for images/PDFs) */
  previewUrl?: string;
  /** File validation status */
  isValid: boolean;
  /** Validation error message */
  error?: string;
}

/**
 * Props for FileDropzone component.
 */
export interface FileDropzoneProps {
  /** Accepted file types (MIME type -> extensions) */
  accept?: AcceptedFileTypes;

  /** Maximum file size in bytes */
  maxSize?: number;

  /** Maximum number of files (default: 1) */
  maxFiles?: number;

  /** Callback when file(s) are selected */
  onFileSelect: (files: SelectedFile[]) => void;

  /** Callback when file is removed */
  onFileRemove?: (file: SelectedFile) => void;

  /** Currently selected files */
  selectedFiles?: SelectedFile[];

  /** Disabled state */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Label for the dropzone */
  label?: string;

  /** Help text (shows accepted types and size) */
  helpText?: string;

  /** Custom placeholder text */
  placeholder?: string;
}

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
 * Gets the file extension from a filename.
 */
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? `.${ext.toLowerCase()}` : '';
}

/**
 * Validates a file against accept and size constraints.
 */
function validateFile(
  file: File,
  accept?: AcceptedFileTypes,
  maxSize?: number
): { isValid: boolean; error?: string } {
  // Check file size
  if (maxSize && file.size > maxSize) {
    return {
      isValid: false,
      error: `File exceeds maximum size of ${formatFileSize(maxSize)}`,
    };
  }

  // Check file type
  if (accept) {
    const fileExt = getFileExtension(file.name);
    const mimeType = file.type;

    let isAccepted = false;
    for (const [acceptedMime, acceptedExts] of Object.entries(accept)) {
      if (mimeType === acceptedMime || acceptedExts.includes(fileExt) || acceptedMime === '*/*') {
        isAccepted = true;
        break;
      }
    }

    if (!isAccepted) {
      const acceptedExtensions = Object.values(accept).flat().join(', ');
      return {
        isValid: false,
        error: `Invalid file type. Accepted: ${acceptedExtensions}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Creates a preview URL for the file if applicable.
 */
function createPreviewUrl(file: File): string | undefined {
  if (file.type.startsWith('image/') || file.type === 'application/pdf') {
    return URL.createObjectURL(file);
  }
  return undefined;
}

// =============================================================================
// FILE PREVIEW COMPONENT
// =============================================================================

interface FilePreviewProps {
  selectedFile: SelectedFile;
  onRemove: () => void;
  disabled?: boolean;
}

function FilePreview({ selectedFile, onRemove, disabled }: FilePreviewProps) {
  const { file, isValid, error } = selectedFile;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        isValid ? 'border-border bg-card' : 'border-destructive/50 bg-destructive/5'
      )}
      data-testid="uploaded-file"
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isValid ? 'bg-primary/10' : 'bg-destructive/10'
        )}
      >
        {isValid ? (
          <FileText className="h-5 w-5 text-primary" />
        ) : (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{file.name}</span>
          {isValid && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {error ? <span className="text-destructive">{error}</span> : formatFileSize(file.size)}
        </div>
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Drag-and-drop file upload zone.
 *
 * @param props - Component props
 * @returns Dropzone element
 */
export function FileDropzone({
  accept = { 'application/pdf': ['.pdf'] },
  maxSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 1,
  onFileSelect,
  onFileRemove,
  selectedFiles = [],
  disabled = false,
  className,
  label,
  helpText,
  placeholder,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const canAddMore = selectedFiles.length < maxFiles;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newFiles: SelectedFile[] = [];
      const remaining = maxFiles - selectedFiles.length;

      for (let i = 0; i < Math.min(files.length, remaining); i++) {
        const file = files[i];
        const validation = validateFile(file, accept, maxSize);
        newFiles.push({
          file,
          previewUrl: createPreviewUrl(file),
          isValid: validation.isValid,
          error: validation.error,
        });
      }

      if (newFiles.length > 0) {
        onFileSelect([...selectedFiles, ...newFiles]);
      }
    },
    [accept, maxSize, maxFiles, selectedFiles, onFileSelect]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled || !canAddMore) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, canAddMore, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (disabled || !canAddMore) return;
    inputRef.current?.click();
  }, [disabled, canAddMore]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleRemove = useCallback(
    (file: SelectedFile) => {
      // Revoke preview URL to prevent memory leaks
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      onFileRemove?.(file);
    },
    [onFileRemove]
  );

  // Generate accept string for input
  const acceptString = Object.entries(accept)
    .map(([mime, exts]) => [mime, ...exts].join(','))
    .join(',');

  // Default help text
  const defaultHelpText =
    helpText ??
    `Accepted: ${Object.values(accept).flat().join(', ')} | Max size: ${formatFileSize(maxSize)}`;

  return (
    <div className={cn('space-y-3', className)} data-testid="file-dropzone">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple={maxFiles > 1}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-label="File input"
      />

      {/* Dropzone */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'cursor-pointer'
          )}
          aria-label={placeholder ?? 'Drop files here or click to browse'}
        >
          <div
            className={cn(
              'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
              isDragActive ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn('h-6 w-6', isDragActive ? 'text-primary' : 'text-muted-foreground')}
            />
          </div>
          <p className="text-sm font-medium">
            {placeholder ?? 'Drop files here or click to browse'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{defaultHelpText}</p>
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <FilePreview
              key={`${file.file.name}-${index}`}
              selectedFile={file}
              onRemove={() => handleRemove(file)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* File count indicator */}
      {maxFiles > 1 && (
        <p className="text-xs text-muted-foreground">
          {selectedFiles.length}/{maxFiles} files
        </p>
      )}
    </div>
  );
}
