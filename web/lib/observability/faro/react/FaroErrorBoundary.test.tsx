/**
 * Tests for FaroErrorBoundary component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FaroErrorBoundary, withFaroErrorBoundary } from './FaroErrorBoundary';

// Use vi.hoisted for mock functions
const mockPushError = vi.hoisted(() => vi.fn());
const mockPushEvent = vi.hoisted(() => vi.fn());

// Mock getFaro
vi.mock('../initialize', () => ({
  getFaro: vi.fn(() => ({
    api: {
      pushError: mockPushError,
      pushEvent: mockPushEvent,
    },
  })),
}));

// Mock privacy module
vi.mock('../privacy', () => ({
  scrubError: vi.fn((error: Error) => ({ message: error.message, stack: error.stack })),
  scrubString: vi.fn((str: string) => str),
}));

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

// Suppress console.error for error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('FaroErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <FaroErrorBoundary>
        <div>Child content</div>
      </FaroErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback when error occurs', () => {
    render(
      <FaroErrorBoundary fallback={<div>Error fallback</div>}>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(screen.getByText('Error fallback')).toBeInTheDocument();
  });

  it('renders default fallback when no fallback provided', () => {
    render(
      <FaroErrorBoundary>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('reports error to Faro', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushError: mockPushError, pushEvent: mockPushEvent },
    } as unknown as ReturnType<typeof getFaro>);

    render(
      <FaroErrorBoundary>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(mockPushError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: expect.any(Object),
        type: 'react-error-boundary',
      })
    );
  });

  it('includes component stack in stackFrames', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushError: mockPushError, pushEvent: mockPushEvent },
    } as unknown as ReturnType<typeof getFaro>);

    render(
      <FaroErrorBoundary>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(mockPushError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        stackFrames: expect.arrayContaining([
          expect.objectContaining({
            filename: 'react-component-stack',
            function: expect.any(String),
          }),
        ]),
      })
    );
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <FaroErrorBoundary onError={onError}>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    // onError receives (error: Error, errorInfo: ErrorInfo)
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('renders function fallback with reset', async () => {
    const user = userEvent.setup();

    render(
      <FaroErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(screen.getByText('Error: Test error')).toBeInTheDocument();

    // After reset, component should re-render (and throw again since ThrowingComponent always throws)
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    // Still shows error since component throws again
    expect(screen.getByText('Error: Test error')).toBeInTheDocument();
  });

  it('includes componentName in error context', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushError: mockPushError, pushEvent: mockPushEvent },
    } as unknown as ReturnType<typeof getFaro>);

    render(
      <FaroErrorBoundary componentName="TestBoundary">
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(mockPushError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: expect.objectContaining({
          boundary: 'TestBoundary',
        }),
      })
    );
  });

  it('includes default boundary name when componentName not provided', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushError: mockPushError, pushEvent: mockPushEvent },
    } as unknown as ReturnType<typeof getFaro>);

    render(
      <FaroErrorBoundary>
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(mockPushError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: expect.objectContaining({
          boundary: 'FaroErrorBoundary',
        }),
      })
    );
  });

  it('pushes react_error_boundary event', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue({
      api: { pushError: mockPushError, pushEvent: mockPushEvent },
    } as unknown as ReturnType<typeof getFaro>);

    render(
      <FaroErrorBoundary componentName="TestComponent">
        <ThrowingComponent />
      </FaroErrorBoundary>
    );

    expect(mockPushEvent).toHaveBeenCalledWith('react_error_boundary', {
      boundary: 'TestComponent',
      errorType: 'Error',
      errorMessage: expect.any(String),
    });
  });

  it('handles case when Faro is not available', async () => {
    const { getFaro } = await import('../initialize');
    vi.mocked(getFaro).mockReturnValue(null);

    // Should not throw
    expect(() =>
      render(
        <FaroErrorBoundary>
          <ThrowingComponent />
        </FaroErrorBoundary>
      )
    ).not.toThrow();

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('withFaroErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    function TestComponent() {
      return <div>Test content</div>;
    }

    const WrappedComponent = withFaroErrorBoundary(TestComponent);
    render(<WrappedComponent />);

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches errors from wrapped component', () => {
    const WrappedComponent = withFaroErrorBoundary(ThrowingComponent);
    render(<WrappedComponent />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('passes props to wrapped component', () => {
    function TestComponent({ message }: { message: string }) {
      return <div>{message}</div>;
    }

    const WrappedComponent = withFaroErrorBoundary(TestComponent);
    render(<WrappedComponent message="Hello World" />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('uses display name from wrapped component', () => {
    function MyCustomComponent() {
      return <div>Content</div>;
    }
    MyCustomComponent.displayName = 'CustomName';

    const WrappedComponent = withFaroErrorBoundary(MyCustomComponent);
    expect(WrappedComponent.displayName).toBe('withFaroErrorBoundary(CustomName)');
  });
});
