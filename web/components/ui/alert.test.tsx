import { render, screen } from '@/tests/test-utils';
import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert', () => {
  describe('rendering', () => {
    it('renders alert', () => {
      render(<Alert>Alert content</Alert>);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(<Alert>Alert message</Alert>);

      expect(screen.getByText('Alert message')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Alert variant="default">Default alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('bg-background');
    });

    it('renders destructive variant', () => {
      render(<Alert variant="destructive">Error alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('text-destructive');
    });

    it('uses default variant when not specified', () => {
      render(<Alert>Default alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('bg-background');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Alert className="custom-class">Alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('custom-class');
    });

    it('preserves variant classes with custom className', () => {
      render(
        <Alert variant="destructive" className="custom-class">
          Alert
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('text-destructive', 'custom-class');
    });
  });

  describe('styling', () => {
    it('has border styling', () => {
      render(<Alert>Alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('border', 'rounded-lg');
    });

    it('has padding', () => {
      render(<Alert>Alert</Alert>);

      expect(screen.getByRole('alert')).toHaveClass('p-4');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to alert element', () => {
      const ref = vi.fn();
      render(<Alert ref={ref}>Alert</Alert>);

      expect(ref).toHaveBeenCalled();
    });
  });
});

describe('AlertTitle', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(<AlertTitle>Alert Title</AlertTitle>);

      expect(screen.getByRole('heading', { level: 5 })).toBeInTheDocument();
    });

    it('renders children', () => {
      render(<AlertTitle>Error Occurred</AlertTitle>);

      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has font styling', () => {
      render(<AlertTitle>Title</AlertTitle>);

      expect(screen.getByRole('heading')).toHaveClass('font-medium');
    });

    it('has margin styling', () => {
      render(<AlertTitle>Title</AlertTitle>);

      expect(screen.getByRole('heading')).toHaveClass('mb-1');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<AlertTitle className="custom-class">Title</AlertTitle>);

      expect(screen.getByRole('heading')).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to heading element', () => {
      const ref = vi.fn();
      render(<AlertTitle ref={ref}>Title</AlertTitle>);

      expect(ref).toHaveBeenCalled();
    });
  });
});

describe('AlertDescription', () => {
  describe('rendering', () => {
    it('renders description', () => {
      render(<AlertDescription>Description text</AlertDescription>);

      expect(screen.getByText('Description text')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has text size styling', () => {
      render(<AlertDescription>Description</AlertDescription>);

      expect(screen.getByText('Description')).toHaveClass('text-sm');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<AlertDescription className="custom-class">Description</AlertDescription>);

      expect(screen.getByText('Description')).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to description element', () => {
      const ref = vi.fn();
      render(<AlertDescription ref={ref}>Description</AlertDescription>);

      expect(ref).toHaveBeenCalled();
    });
  });
});

describe('Alert composition', () => {
  it('renders full alert with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Please check your input.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Please check your input.')).toBeInTheDocument();
  });

  it('renders destructive alert with content', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('text-destructive');
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });
});
