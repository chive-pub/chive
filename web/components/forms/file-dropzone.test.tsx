/**
 * Tests for FileDropzone component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileDropzone, type SelectedFile } from './file-dropzone';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a mock File.
 */
function createMockFile(name: string, type: string, size: number = 1024): File {
  const content = new ArrayBuffer(size);
  return new File([content], name, { type });
}

// =============================================================================
// TESTS
// =============================================================================

describe('FileDropzone', () => {
  const defaultProps = {
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 1,
    selectedFiles: [] as SelectedFile[],
    onFileSelect: vi.fn(),
    onFileRemove: vi.fn(),
  };

  it('renders with placeholder text', () => {
    render(<FileDropzone {...defaultProps} placeholder="Drop your PDF here" />);

    expect(screen.getByText('Drop your PDF here')).toBeInTheDocument();
  });

  it('renders help text when provided', () => {
    render(<FileDropzone {...defaultProps} helpText="PDF format only" />);

    expect(screen.getByText('PDF format only')).toBeInTheDocument();
  });

  it('displays selected files', () => {
    const selectedFiles: SelectedFile[] = [
      { file: createMockFile('paper.pdf', 'application/pdf', 1024000), isValid: true },
    ];

    render(<FileDropzone {...defaultProps} selectedFiles={selectedFiles} />);

    expect(screen.getByText('paper.pdf')).toBeInTheDocument();
  });

  it('calls onFileRemove when remove button clicked', async () => {
    const user = userEvent.setup();
    const onFileRemove = vi.fn();
    const selectedFiles: SelectedFile[] = [
      { file: createMockFile('paper.pdf', 'application/pdf'), isValid: true },
    ];

    render(
      <FileDropzone {...defaultProps} selectedFiles={selectedFiles} onFileRemove={onFileRemove} />
    );

    const removeButton = screen.getByRole('button', { name: /remove/i });
    await user.click(removeButton);

    expect(onFileRemove).toHaveBeenCalledWith(selectedFiles[0]);
  });

  it('displays file size in human readable format', () => {
    const selectedFiles: SelectedFile[] = [
      { file: createMockFile('paper.pdf', 'application/pdf', 2 * 1024 * 1024), isValid: true },
    ];

    render(<FileDropzone {...defaultProps} selectedFiles={selectedFiles} />);

    expect(screen.getByText(/2.*MB/i)).toBeInTheDocument();
  });

  it('shows error state for invalid files', () => {
    const selectedFiles: SelectedFile[] = [
      {
        file: createMockFile('paper.pdf', 'application/pdf'),
        isValid: false,
        error: 'File too large',
      },
    ];

    render(<FileDropzone {...defaultProps} selectedFiles={selectedFiles} />);

    expect(screen.getByText('File too large')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    render(<FileDropzone {...defaultProps} disabled />);

    // The dropzone should have opacity or other disabled styling
    const dropzone = screen.getByText(/drop/i).closest('div');
    expect(dropzone).toHaveClass('opacity-50');
  });

  it('hides dropzone when max files reached', () => {
    const selectedFiles: SelectedFile[] = [
      { file: createMockFile('paper.pdf', 'application/pdf'), isValid: true },
    ];

    render(<FileDropzone {...defaultProps} maxFiles={1} selectedFiles={selectedFiles} />);

    // The "Click to upload" text should not be visible
    expect(screen.queryByText(/click to upload/i)).not.toBeInTheDocument();
  });

  it('displays multiple selected files', () => {
    const selectedFiles: SelectedFile[] = [
      { file: createMockFile('paper1.pdf', 'application/pdf'), isValid: true },
      { file: createMockFile('paper2.pdf', 'application/pdf'), isValid: true },
      { file: createMockFile('data.csv', 'text/csv'), isValid: true },
    ];

    render(<FileDropzone {...defaultProps} maxFiles={5} selectedFiles={selectedFiles} />);

    expect(screen.getByText('paper1.pdf')).toBeInTheDocument();
    expect(screen.getByText('paper2.pdf')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });
});
