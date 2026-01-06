import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { SearchInput, InlineSearch } from './search-input';

describe('SearchInput', () => {
  it('renders with placeholder', () => {
    render(<SearchInput placeholder="Search preprints..." />);
    expect(screen.getByPlaceholderText('Search preprints...')).toBeInTheDocument();
  });

  it('renders with default value', () => {
    render(<SearchInput defaultValue="machine learning" />);
    expect(screen.getByDisplayValue('machine learning')).toBeInTheDocument();
  });

  it('updates value on input', async () => {
    const user = userEvent.setup();
    render(<SearchInput />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'quantum');
    expect(input).toHaveValue('quantum');
  });

  it('calls onChange on input', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test');
    expect(onChange).toHaveBeenCalledWith('t');
    expect(onChange).toHaveBeenCalledWith('te');
    expect(onChange).toHaveBeenCalledWith('tes');
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('calls onSearch on form submit', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'physics{enter}');
    expect(onSearch).toHaveBeenCalledWith('physics');
  });

  it('trims query before submit', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, '  trimmed  {enter}');
    expect(onSearch).toHaveBeenCalledWith('trimmed');
  });

  it('does not submit empty query', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, '   {enter}');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('shows clear button when has value', async () => {
    const user = userEvent.setup();
    render(<SearchInput />);
    const input = screen.getByRole('searchbox');

    // Clear button should not be visible initially
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();

    // Type something
    await user.type(input, 'test');

    // Clear button should appear
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('clears value on clear button click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput defaultValue="initial" onChange={onChange} />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows loading spinner when isLoading', () => {
    render(<SearchInput isLoading />);
    // Check for spinner class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies size variant classes', () => {
    const { rerender } = render(<SearchInput size="sm" />);
    let input = screen.getByRole('searchbox');
    expect(input).toHaveClass('h-9');

    rerender(<SearchInput size="lg" />);
    input = screen.getByRole('searchbox');
    expect(input).toHaveClass('h-12');
  });

  it('applies custom className', () => {
    const { container } = render(<SearchInput className="custom-search-class" />);
    expect(container.firstChild).toHaveClass('custom-search-class');
  });

  it('has aria-label for accessibility', () => {
    render(<SearchInput />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});

describe('InlineSearch', () => {
  it('renders with placeholder', () => {
    render(<InlineSearch onSearch={() => {}} placeholder="Quick search..." />);
    expect(screen.getByPlaceholderText('Quick search...')).toBeInTheDocument();
  });

  it('calls onSearch on submit', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<InlineSearch onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test{enter}');
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('clears value after submit', async () => {
    const user = userEvent.setup();
    render(<InlineSearch onSearch={() => {}} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test{enter}');
    expect(input).toHaveValue('');
  });

  it('does not submit empty query', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<InlineSearch onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, '   {enter}');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<InlineSearch onSearch={() => {}} className="custom-inline-class" />);
    const form = screen.getByRole('searchbox').closest('form');
    expect(form).toHaveClass('custom-inline-class');
  });
});
