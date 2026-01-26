import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { VersionSelector } from './version-selector';
import type { VersionBumpType } from '@/lib/hooks/use-eprint-mutations';

describe('VersionSelector', () => {
  const defaultProps = {
    value: 'patch' as VersionBumpType,
    onChange: vi.fn(),
  };

  it('renders all three version options', () => {
    render(<VersionSelector {...defaultProps} />);

    expect(screen.getByText('Patch')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
  });

  it('renders option descriptions', () => {
    render(<VersionSelector {...defaultProps} />);

    expect(screen.getByText(/Typo fixes, formatting corrections/)).toBeInTheDocument();
    expect(screen.getByText(/New content, significant additions/)).toBeInTheDocument();
    expect(screen.getByText(/Fundamental revision, methodology changes/)).toBeInTheDocument();
  });

  it('renders example tags for each option', () => {
    render(<VersionSelector {...defaultProps} />);

    // Patch examples
    expect(screen.getByText('Fixed typos')).toBeInTheDocument();
    expect(screen.getByText('Updated citations')).toBeInTheDocument();

    // Minor examples
    expect(screen.getByText('Added new section')).toBeInTheDocument();
    expect(screen.getByText('Expanded analysis')).toBeInTheDocument();

    // Major examples
    expect(screen.getByText('Complete rewrite')).toBeInTheDocument();
    expect(screen.getByText('New methodology')).toBeInTheDocument();
  });

  it('shows current version when provided', () => {
    render(<VersionSelector {...defaultProps} currentVersion="1.2.3" />);

    expect(screen.getByText('Current: v1.2.3')).toBeInTheDocument();
  });

  it('does not show current version when not provided', () => {
    render(<VersionSelector {...defaultProps} />);

    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  it('calls onChange with patch when patch option is clicked', () => {
    const onChange = vi.fn();
    render(<VersionSelector {...defaultProps} value="minor" onChange={onChange} />);

    const patchOption = screen.getByText('Patch').closest('div[role="presentation"]');
    fireEvent.click(patchOption!);

    expect(onChange).toHaveBeenCalledWith('patch');
  });

  it('calls onChange with minor when minor option is clicked', () => {
    const onChange = vi.fn();
    render(<VersionSelector {...defaultProps} value="patch" onChange={onChange} />);

    const minorOption = screen.getByText('Minor').closest('div[role="presentation"]');
    fireEvent.click(minorOption!);

    expect(onChange).toHaveBeenCalledWith('minor');
  });

  it('calls onChange with major when major option is clicked', () => {
    const onChange = vi.fn();
    render(<VersionSelector {...defaultProps} value="patch" onChange={onChange} />);

    const majorOption = screen.getByText('Major').closest('div[role="presentation"]');
    fireEvent.click(majorOption!);

    expect(onChange).toHaveBeenCalledWith('major');
  });

  it('applies visual indication to selected option', () => {
    render(<VersionSelector {...defaultProps} value="minor" />);

    const minorOption = screen.getByText('Minor').closest('div[role="presentation"]');
    expect(minorOption).toHaveClass('border-primary');
    expect(minorOption).toHaveClass('bg-primary/5');
  });

  it('does not apply selected styles to unselected options', () => {
    render(<VersionSelector {...defaultProps} value="minor" />);

    const patchOption = screen.getByText('Patch').closest('div[role="presentation"]');
    expect(patchOption).not.toHaveClass('border-primary');
    expect(patchOption).not.toHaveClass('bg-primary/5');
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<VersionSelector {...defaultProps} onChange={onChange} disabled={true} />);

    const minorOption = screen.getByText('Minor').closest('div[role="presentation"]');
    fireEvent.click(minorOption!);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies disabled styles when disabled', () => {
    render(<VersionSelector {...defaultProps} disabled={true} />);

    const patchOption = screen.getByText('Patch').closest('div[role="presentation"]');
    expect(patchOption).toHaveClass('opacity-50');
    expect(patchOption).toHaveClass('cursor-not-allowed');
  });

  it('renders the Version Bump Type label', () => {
    render(<VersionSelector {...defaultProps} />);

    expect(screen.getByText('Version Bump Type')).toBeInTheDocument();
  });

  it('renders radio inputs for each option', () => {
    render(<VersionSelector {...defaultProps} />);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(3);
  });

  it('selects the correct radio based on value prop', () => {
    render(<VersionSelector {...defaultProps} value="major" />);

    const majorRadio = screen.getByRole('radio', { name: /major/i });
    expect(majorRadio).toBeChecked();
  });
});
