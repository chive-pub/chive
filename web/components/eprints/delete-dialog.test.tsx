import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DeleteEprintDialog } from './delete-dialog';

describe('DeleteEprintDialog', () => {
  const defaultProps = {
    title: 'Test Eprint Title',
    uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
    canDelete: true,
    onConfirm: vi.fn(),
  };

  it('renders trigger button', () => {
    render(<DeleteEprintDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('renders custom children as trigger', () => {
    render(
      <DeleteEprintDialog {...defaultProps}>
        <button>Custom Delete Button</button>
      </DeleteEprintDialog>
    );
    expect(screen.getByRole('button', { name: /custom delete button/i })).toBeInTheDocument();
  });

  it('opens dialog on trigger click', async () => {
    render(<DeleteEprintDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('shows eprint title in confirmation message', async () => {
    render(<DeleteEprintDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Test Eprint Title/)).toBeInTheDocument();
    });
  });

  it('lists consequences of deletion', async () => {
    render(<DeleteEprintDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/The eprint record and document/)).toBeInTheDocument();
      expect(screen.getByText(/All endorsements associated with this eprint/)).toBeInTheDocument();
      expect(screen.getByText(/All reviews and comments on this eprint/)).toBeInTheDocument();
      expect(screen.getByText(/View and download metrics/)).toBeInTheDocument();
    });
  });

  it('calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn();
    render(<DeleteEprintDialog {...defaultProps} onConfirm={onConfirm} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /delete eprint/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes dialog after confirmation', async () => {
    render(<DeleteEprintDialog {...defaultProps} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /delete eprint/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('cancel button closes dialog without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<DeleteEprintDialog {...defaultProps} onConfirm={onConfirm} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables buttons when isPending is true', async () => {
    render(<DeleteEprintDialog {...defaultProps} isPending={true} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /deleting/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('shows loading state when isPending is true', async () => {
    render(<DeleteEprintDialog {...defaultProps} isPending={true} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/deleting/i)).toBeInTheDocument();
    });
  });

  it('disables default trigger button when canDelete is false', () => {
    render(<DeleteEprintDialog {...defaultProps} canDelete={false} />);

    const trigger = screen.getByRole('button', { name: /delete/i });
    expect(trigger).toBeDisabled();
  });
});
