import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
  });

  it('renders with specified type', () => {
    render(<Input type="email" placeholder="Enter email" />);

    const input = screen.getByPlaceholderText('Enter email');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders with password type', () => {
    render(<Input type="password" placeholder="Enter password" />);

    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('handles value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Input placeholder="Type here" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('Type here');
    await user.type(input, 'Hello');

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('Hello');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />);

    const input = screen.getByPlaceholderText('Disabled');
    expect(input).toBeDisabled();
  });

  it('does not allow input when disabled', async () => {
    const user = userEvent.setup();

    render(<Input disabled placeholder="Disabled" />);

    const input = screen.getByPlaceholderText('Disabled');
    await user.type(input, 'test');

    expect(input).toHaveValue('');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" placeholder="Custom" />);

    const input = screen.getByPlaceholderText('Custom');
    expect(input).toHaveClass('custom-input');
  });

  it('has correct base styling', () => {
    render(<Input placeholder="Styled" />);

    const input = screen.getByPlaceholderText('Styled');
    expect(input).toHaveClass('flex');
    expect(input).toHaveClass('h-9');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('rounded-md');
    expect(input).toHaveClass('border');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<Input ref={ref} placeholder="With ref" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('handles file type', () => {
    render(<Input type="file" data-testid="file-input" />);

    const input = screen.getByTestId('file-input');
    expect(input).toHaveAttribute('type', 'file');
  });

  it('shows placeholder text with muted styling', () => {
    render(<Input placeholder="Placeholder text" />);

    const input = screen.getByPlaceholderText('Placeholder text');
    expect(input).toHaveClass('placeholder:text-muted-foreground');
  });
});
