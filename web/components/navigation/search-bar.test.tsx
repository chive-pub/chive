import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SearchBar } from './search-bar';

// Mock useRouter from next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Mock the useInstantSearch hook
vi.mock('@/lib/hooks/use-search', () => ({
  useInstantSearch: () => ({
    data: null,
    isLoading: false,
  }),
}));

// Mock the useAuthorSearch hook
vi.mock('@/lib/hooks/use-author', () => ({
  useAuthorSearch: () => ({
    data: null,
    isLoading: false,
  }),
}));

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
};

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search eprints & authors...');
  });

  it('has search form with correct role', () => {
    render(<SearchBar />, { wrapper: createWrapper() });

    const form = screen.getByRole('search', { name: 'Search eprints and authors' });
    expect(form).toBeInTheDocument();
  });

  it('has accessible label for input', () => {
    render(<SearchBar />, { wrapper: createWrapper() });

    const label = screen.getByText('Search for eprints and authors');
    expect(label).toHaveClass('sr-only');
  });

  it('updates input value on typing', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    await user.type(input, 'machine learning');

    expect(input).toHaveValue('machine learning');
  });

  it('navigates to search page on form submit', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    await user.type(input, 'neural networks');
    await user.keyboard('{Enter}');

    expect(mockPush).toHaveBeenCalledWith('/search?q=neural%20networks');
  });

  it('does not navigate when query is empty', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: 'Submit search' });
    await user.click(submitButton);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate when query is only whitespace', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    await user.type(input, '   ');
    await user.keyboard('{Enter}');

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('trims whitespace from query', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    await user.type(input, '  quantum physics  ');
    await user.keyboard('{Enter}');

    expect(mockPush).toHaveBeenCalledWith('/search?q=quantum%20physics');
  });

  it('encodes special characters in query', async () => {
    const user = userEvent.setup();

    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    await user.type(input, 'test&query=1');
    await user.keyboard('{Enter}');

    expect(mockPush).toHaveBeenCalledWith('/search?q=test%26query%3D1');
  });

  it('renders submit button', () => {
    render(<SearchBar />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: 'Submit search' });
    expect(submitButton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<SearchBar className="custom-search" />, { wrapper: createWrapper() });

    const form = screen.getByRole('search', { name: 'Search eprints and authors' });
    expect(form).toHaveClass('custom-search');
  });

  it('has autocomplete disabled', () => {
    render(<SearchBar />, { wrapper: createWrapper() });

    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('autoComplete', 'off');
  });
});
