import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { SearchInput, InlineSearch } from './search-input';

describe('SearchInput', () => {
  it('renders with placeholder', () => {
    render(<SearchInput placeholder="Search eprints..." />);
    expect(screen.getByPlaceholderText('Search eprints...')).toBeInTheDocument();
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

  it('calls onSearch on every input change (instant filter)', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<InlineSearch onSearch={onSearch} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    expect(onSearch).toHaveBeenCalledWith('t');
    expect(onSearch).toHaveBeenCalledWith('te');
    expect(onSearch).toHaveBeenCalledWith('tes');
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('shows clear button when has value', async () => {
    const user = userEvent.setup();
    render(<InlineSearch onSearch={() => {}} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('clears value and calls onSearch when clear clicked', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<InlineSearch onSearch={onSearch} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    onSearch.mockClear();
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(input).toHaveValue('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('applies custom className', () => {
    render(<InlineSearch onSearch={() => {}} className="custom-inline-class" />);
    const container = screen.getByRole('textbox').closest('div');
    expect(container).toHaveClass('custom-inline-class');
  });
});
