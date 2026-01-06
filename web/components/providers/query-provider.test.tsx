import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';

import { QueryProvider } from './query-provider';

// Test component that uses React Query
function TestQueryComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['test'],
    queryFn: async () => 'test data',
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{data}</div>;
}

describe('QueryProvider', () => {
  it('renders children', () => {
    render(
      <QueryProvider>
        <div data-testid="child">Child content</div>
      </QueryProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('provides QueryClient to children', async () => {
    render(
      <QueryProvider>
        <TestQueryComponent />
      </QueryProvider>
    );

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Then shows data
    expect(await screen.findByText('test data')).toBeInTheDocument();
  });

  it('maintains same QueryClient across re-renders', async () => {
    const { rerender } = render(
      <QueryProvider>
        <TestQueryComponent />
      </QueryProvider>
    );

    // Wait for initial query to complete
    expect(await screen.findByText('test data')).toBeInTheDocument();

    rerender(
      <QueryProvider>
        <TestQueryComponent />
      </QueryProvider>
    );

    // Component should still work after rerender
    expect(screen.getByText('test data')).toBeInTheDocument();
  });

  it('supports multiple children', () => {
    render(
      <QueryProvider>
        <div data-testid="child1">First</div>
        <div data-testid="child2">Second</div>
      </QueryProvider>
    );

    expect(screen.getByTestId('child1')).toBeInTheDocument();
    expect(screen.getByTestId('child2')).toBeInTheDocument();
  });
});

describe('QueryProvider DevTools', () => {
  it('does not include DevTools in test environment', () => {
    const { container } = render(
      <QueryProvider>
        <div>Content</div>
      </QueryProvider>
    );

    // DevTools are only shown in development
    // In test environment, they should not be present
    const devtoolsButton = container.querySelector('[aria-label="Open React Query Devtools"]');
    expect(devtoolsButton).not.toBeInTheDocument();
  });
});
