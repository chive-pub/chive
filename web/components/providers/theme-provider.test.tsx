import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ThemeProvider } from './theme-provider';

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider" data-theme-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    systemTheme: 'light',
    themes: ['light', 'dark', 'system'],
    resolvedTheme: 'light',
  }),
}));

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Child content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('wraps children with NextThemesProvider', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  it('sets attribute to class', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId('theme-provider');
    const props = JSON.parse(provider.getAttribute('data-theme-props') || '{}');
    expect(props.attribute).toBe('class');
  });

  it('sets default theme to system', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId('theme-provider');
    const props = JSON.parse(provider.getAttribute('data-theme-props') || '{}');
    expect(props.defaultTheme).toBe('system');
  });

  it('enables system theme detection', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId('theme-provider');
    const props = JSON.parse(provider.getAttribute('data-theme-props') || '{}');
    expect(props.enableSystem).toBe(true);
  });

  it('disables transition on change', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId('theme-provider');
    const props = JSON.parse(provider.getAttribute('data-theme-props') || '{}');
    expect(props.disableTransitionOnChange).toBe(true);
  });

  it('passes additional props to NextThemesProvider', () => {
    render(
      <ThemeProvider storageKey="custom-key" forcedTheme="dark">
        <div>Content</div>
      </ThemeProvider>
    );

    const provider = screen.getByTestId('theme-provider');
    const props = JSON.parse(provider.getAttribute('data-theme-props') || '{}');
    expect(props.storageKey).toBe('custom-key');
    expect(props.forcedTheme).toBe('dark');
  });

  it('supports multiple children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child1">First</div>
        <div data-testid="child2">Second</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('child1')).toBeInTheDocument();
    expect(screen.getByTestId('child2')).toBeInTheDocument();
  });
});
